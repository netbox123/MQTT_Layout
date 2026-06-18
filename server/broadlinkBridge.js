import mqtt from 'mqtt';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TRANSMITTER_ID  = 'rm-mini';
const HA_ENTITY_ID    = 'remote.broadlink_rm4_mini';
const HA_STORAGE_FILE = 'broadlink_remote_24dfa74fb90e_codes';
const HA_CONTAINER    = 'big-bear-home-assistant';
const LEARN_TIMEOUT   = 32000;
const POLL_MS         = 1000;

async function haService(haUrl, token, domain, service, data) {
  const res = await fetch(`${haUrl}/api/services/${domain}/${service}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HA ${res.status}: ${await res.text()}`);
}

async function readStoredCodes() {
  try {
    const { stdout } = await execAsync(
      `docker exec ${HA_CONTAINER} cat /config/.storage/${HA_STORAGE_FILE}`
    );
    return JSON.parse(stdout).data ?? {};
  } catch { return {}; }
}

export function startBroadlinkBridge(mqttConfig, haConfig) {
  const ha        = haConfig;
  const brokerUrl = mqttConfig.broker_url || 'mqtt://localhost:1883';

  const client = mqtt.connect(brokerUrl, {
    clientId:        'broadlink-bridge',
    username:        mqttConfig.username,
    password:        mqttConfig.password,
    reconnectPeriod: 5000,
    clean:           true,
  });

  let learnPoller = null;

  // learn payload = JSON {cmd, device} or plain cmdKey string (ESP32 fallback)
  // HA's learn_command REST call returns immediately; RM Mini enters learn mode in background.
  // We poll the storage file until any new code appears, then publish the command name.
  async function handleLearn(payload) {
    let cmdKey, deviceName;
    try {
      const parsed = JSON.parse(payload.trim());
      cmdKey     = parsed.cmd;
      deviceName = parsed.device;
    } catch {
      cmdKey     = payload.trim();
      deviceName = undefined;
    }
    if (!cmdKey) return;

    if (learnPoller) { clearInterval(learnPoller); learnPoller = null; }

    console.log(`[Broadlink] Learning "${cmdKey}" — point remote at RM Mini...`);

    const beforeJson = JSON.stringify(await readStoredCodes());

    // Fire learn_command (non-blocking on HA side)
    // Broadlink requires a device name — fall back to 'default' if none provided
    const learnData = { entity_id: HA_ENTITY_ID, command: cmdKey, device: deviceName || 'default' };
    haService(ha.url, ha.token, 'remote', 'learn_command', learnData)
      .catch(err => console.error('[Broadlink] learn_command error:', err.message));

    const effectiveDevice = deviceName || 'default';
    // Snapshot the current value so we detect a change even if the key already existed
    const beforeCode = JSON.stringify((await readStoredCodes())[effectiveDevice]?.[cmdKey]);

    const deadline = Date.now() + LEARN_TIMEOUT;
    learnPoller = setInterval(async () => {
      const codes = await readStoredCodes();
      const afterCode = JSON.stringify(codes[effectiveDevice]?.[cmdKey]);
      if (afterCode !== 'undefined' && afterCode !== beforeCode) {
        clearInterval(learnPoller); learnPoller = null;
        console.log(`[Broadlink] Learned: ${effectiveDevice}/${cmdKey}`);
        const code = deviceName ? { command: cmdKey, device: deviceName } : cmdKey;
        client.publish(`ir/${TRANSMITTER_ID}/learned`, JSON.stringify(code));
      } else if (Date.now() > deadline) {
        clearInterval(learnPoller); learnPoller = null;
        console.log(`[Broadlink] Learn timeout for "${cmdKey}"`);
      }
    }, POLL_MS);
  }

  // transmit payload = JSON-encoded string or {command, device} object
  async function handleTransmit(payload) {
    try {
      const code = JSON.parse(payload);
      const data = { entity_id: HA_ENTITY_ID };
      if (typeof code === 'string') {
        data.command = code;
      } else if (code && typeof code === 'object' && code.command) {
        data.command = code.command;
        if (code.device) data.device = code.device;
      } else {
        console.error('[Broadlink] Unexpected code format:', code);
        return;
      }
      await haService(ha.url, ha.token, 'remote', 'send_command', data);
      console.log('[Broadlink] Sent:', data.command);
    } catch (err) {
      console.error('[Broadlink] Transmit error:', err.message);
    }
  }

  client.on('connect', () => {
    console.log('[Broadlink] Bridge connected');
    client.subscribe([`ir/${TRANSMITTER_ID}/learn`, `ir/${TRANSMITTER_ID}/transmit`], err => {
      if (err) console.error('[Broadlink] Subscribe error:', err.message);
    });
  });

  client.on('message', (topic, payload) => {
    const str = payload.toString();
    if (topic === `ir/${TRANSMITTER_ID}/learn`)          handleLearn(str);
    else if (topic === `ir/${TRANSMITTER_ID}/transmit`)  handleTransmit(str);
  });

  client.on('error', err => console.error('[Broadlink] MQTT error:', err.message));
}
