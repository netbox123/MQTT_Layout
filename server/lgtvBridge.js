// LG webOS TV bridge: Wake-on-LAN + local webOS control socket, driven over MQTT.
//
//   lgtv/<id>/cmd    ← wake | sleep | input:HDMI_1 | url:<address>
//   lgtv/<id>/state  → on | off            (retained)
//   lgtv/<id>/input  → HDMI_1 | <appId>    (retained)
//
// Devices live in config/lgtv_devices.json: [{ id, name, ip, mac, client_key }].
// The first connection shows a pairing prompt on the TV; the key is then saved
// back into that file.

import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devicesPath = path.join(__dirname, '../config/lgtv_devices.json');

const RECONNECT_MS = 10000;
const REQUEST_TIMEOUT_MS = 5000;
const PAIRING_TIMEOUT_MS = 60000;
const PENDING_INPUT_MS = 60000; // how long a queued input waits for the TV to wake

// Same permission list Home Assistant's aiowebostv uses.
const REGISTRATION = {
  forcePairing: false,
  pairingType: 'PROMPT',
  manifest: {
    appVersion: '1.1',
    manifestVersion: 1,
    permissions: [
      'APP_TO_APP', 'CLOSE', 'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK',
      'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_MEDIA_RECORDING', 'CONTROL_INPUT_TEXT',
      'CONTROL_INPUT_TV', 'CONTROL_MOUSE_AND_KEYBOARD', 'CONTROL_POWER', 'CONTROL_TV_SCREEN',
      'LAUNCH', 'LAUNCH_WEBAPP', 'READ_APP_STATUS', 'READ_COUNTRY_INFO', 'READ_CURRENT_CHANNEL',
      'READ_INPUT_DEVICE_LIST', 'READ_INSTALLED_APPS', 'READ_LGE_SDX', 'READ_LGE_TV_INPUT_EVENTS',
      'READ_NETWORK_STATE', 'READ_NOTIFICATIONS', 'READ_POWER_STATE', 'READ_RUNNING_APPS',
      'READ_SETTINGS', 'READ_TV_CHANNEL_LIST', 'READ_TV_CURRENT_TIME', 'READ_UPDATE_INFO',
      'SEARCH', 'TEST_OPEN', 'TEST_PROTECTED', 'TEST_SECURE', 'UPDATE_FROM_REMOTE_APP',
      'WRITE_NOTIFICATION_ALERT', 'WRITE_NOTIFICATION_TOAST', 'WRITE_SETTINGS',
    ],
  },
};

// Power states that mean the screen is (about to be) usable.
const ON_STATES = new Set(['Active', 'Screen Off', 'Screen Saver']);

export function loadLgtvDevices() {
  try { return JSON.parse(fs.readFileSync(devicesPath, 'utf-8')); } catch { return []; }
}

function saveClientKey(id, key) {
  const devices = loadLgtvDevices();
  const d = devices.find(x => x.id === id);
  if (!d) return;
  d.client_key = key;
  fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2));
}

function sendWol(mac, broadcast = '192.168.0.255') {
  const hex = mac.replace(/[^0-9a-f]/gi, '');
  if (hex.length !== 12) throw new Error(`Bad MAC: ${mac}`);
  const macBuf = Buffer.from(hex, 'hex');
  const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(macBuf)]);
  // Subnet broadcast plus limited broadcast (the Mac mini has two NICs on the LAN),
  // a few copies on both usual ports, since UDP has no delivery guarantee.
  const targets = [];
  for (let i = 0; i < 3; i++)
    for (const addr of [broadcast, '255.255.255.255'])
      for (const port of [9, 7]) targets.push([addr, port]);
  const sock = dgram.createSocket('udp4');
  sock.bind(() => {
    sock.setBroadcast(true);
    let done = 0;
    for (const [addr, port] of targets) {
      sock.send(packet, port, addr, () => { if (++done === targets.length) sock.close(); });
    }
  });
}

class TvLink {
  constructor(device, publish) {
    this.d = device;
    this.publish = publish;
    this.ws = null;
    this.registered = false;
    this.nextId = 1;
    this.pending = new Map();   // id → { resolve, reject, timer }
    this.subs = new Map();      // id → callback
    this.power = 'off';
    this.pendingCmd = null;     // { run, until } — runs once the TV is on
    this.reconnectTimer = null;
    this.connecting = false;
  }

  log(...a) { console.log(`[LGTV ${this.d.id}]`, ...a); }

  setPower(on) {
    const v = on ? 'on' : 'off';
    if (v === this.power) return;
    this.power = v;
    this.publish(`lgtv/${this.d.id}/state`, v);
    if (on) this.flushPendingInput();
  }

  start() { this.connect(); }

  scheduleReconnect(ms = RECONNECT_MS) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), ms);
  }

  async connect() {
    if (this.connecting || this.ws) return;
    this.connecting = true;
    try {
      this.ws = await this.openSocket();
    } catch {
      this.connecting = false;
      this.setPower(false);
      this.scheduleReconnect();
      return;
    }
    this.connecting = false;
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => this.onClose());
    this.ws.on('error', () => {});
    try {
      await this.register();
      await this.subscribeState();
    } catch (err) {
      this.log('Setup failed:', err.message);
      this.ws?.terminate();
    }
  }

  // Older firmware listens on ws://:3000, newer only on wss://:3001 (self-signed).
  openSocket() {
    const tryOne = (url) => new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { handshakeTimeout: 3000, rejectUnauthorized: false });
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
    return tryOne(`ws://${this.d.ip}:3000`).catch(() => tryOne(`wss://${this.d.ip}:3001`));
  }

  onClose() {
    this.ws = null;
    this.registered = false;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('closed')); }
    this.pending.clear();
    this.subs.clear();
    this.setPower(false);
    this.scheduleReconnect();
  }

  onMessage(data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const sub = this.subs.get(msg.id);
    if (sub && msg.type === 'response') sub(msg.payload ?? {});
    const p = this.pending.get(msg.id);
    if (!p) return;
    // During pairing the TV first answers "response" (prompt shown), then "registered".
    if (msg.type === 'response' && msg.payload?.pairingType === 'PROMPT') {
      this.log('Pairing prompt shown on the TV — accept it with the remote');
      return;
    }
    clearTimeout(p.timer);
    this.pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.error || 'error'));
    else p.resolve(msg);
  }

  send(msg, timeoutMs = REQUEST_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error('not connected'));
      const id = msg.id ?? `m${this.nextId++}`;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('timeout')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  request(uri, payload = {}) {
    return this.send({ type: 'request', uri: `ssap://${uri}`, payload }).then(m => m.payload ?? {});
  }

  subscribe(uri, cb) {
    const id = `s${this.nextId++}`;
    this.subs.set(id, cb);
    return this.send({ id, type: 'subscribe', uri: `ssap://${uri}`, payload: {} })
      .then(m => cb(m.payload ?? {}));
  }

  async register() {
    // Newer webOS wants a system-info request before registration; its answer doesn't matter.
    await this.request('system/getSystemInfo').catch(() => {});
    const res = await this.send(
      { type: 'register', payload: { ...REGISTRATION, 'client-key': this.d.client_key || undefined } },
      PAIRING_TIMEOUT_MS,
    );
    const key = res.payload?.['client-key'];
    if (!key) throw new Error('No client key');
    if (key !== this.d.client_key) {
      this.d.client_key = key;
      saveClientKey(this.d.id, key);
      this.log('Paired, client key saved');
    }
    this.registered = true;
  }

  async subscribeState() {
    await this.subscribe('com.webos.service.tvpower/power/getPowerState', (p) => {
      if (p.state) this.setPower(ON_STATES.has(p.state));
    }).catch(() => this.setPower(true)); // older firmware: being connected means on
    await this.subscribe('com.webos.applicationManager/getForegroundAppInfo', (p) => {
      if (!p.appId) return;
      const m = /^com\.webos\.app\.hdmi(\d)$/.exec(p.appId);
      this.publish(`lgtv/${this.d.id}/input`, m ? `HDMI_${m[1]}` : p.appId);
    }).catch(() => {});
  }

  flushPendingInput() {
    const p = this.pendingCmd;
    if (!p) return;
    this.pendingCmd = null;
    if (Date.now() > p.until) return;
    // Give the TV a moment after waking before acting.
    setTimeout(p.run, 3000);
  }

  // Run now if the TV is on, otherwise wake it and run once it reports on.
  whenOn(run) {
    if (this.registered && this.power === 'on') return run();
    this.pendingCmd = { run, until: Date.now() + PENDING_INPUT_MS };
    this.wake();
  }

  async openUrl(target) {
    try {
      // launch {id: browser, target} only opens the browser; open {target} also loads the page.
      await this.request('system.launcher/open', { target });
      this.log('Browser →', target);
    } catch (err) { this.log('launch failed:', err.message); }
  }

  async switchInput(inputId) {
    try {
      await this.request('tv/switchInput', { inputId });
      this.log('Input →', inputId);
    } catch (err) { this.log('switchInput failed:', err.message); }
  }

  wake() {
    this.log('Wake-on-LAN →', this.d.mac);
    try { sendWol(this.d.mac, this.d.broadcast); } catch (err) { this.log(err.message); }
    // Try to (re)connect soon instead of waiting for the next reconnect tick.
    if (!this.ws) this.scheduleReconnect(4000);
  }

  async command(cmd) {
    if (cmd === 'wake') return this.wake();
    if (cmd === 'sleep') {
      if (this.registered) await this.request('system/turnOff').catch(err => this.log('turnOff failed:', err.message));
      return;
    }
    if (cmd.startsWith('input:')) {
      const inputId = cmd.slice(6);
      return this.whenOn(() => this.switchInput(inputId));
    }
    if (cmd.startsWith('url:')) {
      const target = cmd.slice(4);
      return this.whenOn(() => this.openUrl(target));
    }
    this.log('Unknown command:', cmd);
  }
}

export function startLgtvBridge(mqttCfg) {
  const devices = loadLgtvDevices().filter(d => d.id && d.ip && d.mac);
  if (!devices.length) return;

  const client = mqtt.connect(mqttCfg.broker_url || 'mqtt://localhost:1883', {
    clientId: 'lgtv-bridge',
    username: mqttCfg.username,
    password: mqttCfg.password,
    reconnectPeriod: 5000,
    clean: true,
  });
  const publish = (topic, value) => client.publish(topic, value, { retain: true });

  const links = new Map(devices.map(d => [d.id, new TvLink(d, publish)]));

  client.on('connect', () => {
    console.log(`[LGTV] Bridge connected (${links.size} TV)`);
    client.subscribe('lgtv/+/cmd');
    for (const l of links.values()) publish(`lgtv/${l.d.id}/state`, l.power);
  });
  client.on('message', (topic, payload) => {
    const id = topic.split('/')[1];
    const link = links.get(id);
    if (link) link.command(payload.toString().trim());
  });
  client.on('error', (err) => console.error('[LGTV] MQTT error:', err.message));

  for (const l of links.values()) l.start();
}
