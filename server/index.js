import 'dotenv/config';
import express from 'express';
import https from 'https';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadAllPageConfigs } from './configLoader.js';
import { createMqttClient, loadMqttConfig, saveMqttConfig } from './mqttClient.js';
import { createWsServer } from './wsServer.js';
import net from 'net';
import { handleCameraStream, handleCameraSnapshot } from './cameraProxy.js';
import recipeRoutes from './recipeRoutes.js';

// Kill any ffmpeg processes left over from a previous server session
try {
  execSync('pkill -x ffmpeg', { stdio: 'ignore' });
  console.log('[Camera] Cleaned up stale ffmpeg processes');
} catch { /* none running — ignore */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const httpServer = createServer(app);

function loadHaConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/homeassistant.json'), 'utf-8'));
  } catch {
    return {};
  }
}

// Scan sound directories at startup
const soundsRoot = path.join(__dirname, '../sounds');
function scanSounds(subdir) {
  try {
    return fs.readdirSync(path.join(soundsRoot, subdir))
      .filter(f => /\.(mp3|wav|ogg)$/i.test(f))
      .sort();
  } catch { return []; }
}
const soundCatalog = {
  alert_sounds:  scanSounds('alert_sounds'),
  speech_sounds: scanSounds('speech_sounds'),
};
console.log(`[Sounds] alert: ${soundCatalog.alert_sounds.length}, speech: ${soundCatalog.speech_sounds.length}`);

// Load all page configs at startup
let pageConfigs;
try {
  pageConfigs = loadAllPageConfigs();
  console.log(`[Config] Loaded ${pageConfigs.length} page(s): ${pageConfigs.map(p => p.name).join(', ')}`);
} catch (err) {
  console.error('[Config] Failed to load configs:', err.message);
  process.exit(1);
}

// Sound catalog endpoint
app.get('/api/sounds', (_req, res) => res.json(soundCatalog));

// Serve sound files as static assets
app.use('/sounds', express.static(soundsRoot));

// Image proxy — lets the frontend load cross-origin images via same-origin (required for canvas)
app.get('/api/imageproxy', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('http')) return res.status(400).end();
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).end();
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

// REST endpoint — frontend fetches this once to build its router and sidebar
app.get('/api/pages', (req, res) => {
  res.json(pageConfigs);
});

// Create a new page config file
app.post('/api/pages', (req, res) => {
  const { name, icon, grid_spacing, card_height, card_width, order } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const trimmed = name.trim();
  const slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const pagePath = `/${slug}`;
  const filename = `${slug}.json`;
  const filePath = path.join(__dirname, '../config/pages', filename);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: `Page "${filename}" already exists` });
  }

  const config = { name: trimmed, path: pagePath, cards: [] };
  if (icon) config.icon = icon;
  if (grid_spacing !== undefined) { const gs = parseInt(grid_spacing); config.grid_spacing = Math.max(0, isNaN(gs) ? 16 : gs); }
  if (card_height !== undefined) config.card_height = Math.max(40, parseInt(card_height) || 120);
  if (card_width !== undefined) config.card_width = Math.max(40, parseInt(card_width) || 150);
  if (order !== undefined) config.order = parseInt(order) || 0;
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`[Config] Created new page: ${filename}`);
  res.status(201).json(config);
});

// Rename a page / update page settings
app.patch('/api/pages/:slug', (req, res) => {
  const { name, icon, grid_spacing, card_height, card_width, order, mobile } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const oldFilename = `${req.params.slug}.json`;
  const oldFilePath = path.join(__dirname, '../config/pages', oldFilename);
  if (!fs.existsSync(oldFilePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  const config = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'));
  config.name = name.trim();
  config.icon = typeof icon === 'string' ? icon.trim() : '';
  if (grid_spacing !== undefined) {
    const gs = parseInt(grid_spacing); config.grid_spacing = Math.max(0, isNaN(gs) ? 16 : gs);
  }
  if (card_height !== undefined) {
    config.card_height = Math.max(40, parseInt(card_height) || 120);
  }
  if (card_width !== undefined) {
    config.card_width = Math.max(40, parseInt(card_width) || 150);
  }
  if (order !== undefined) {
    config.order = parseInt(order) || 0;
  }
  if (mobile !== undefined) {
    config.mobile = Boolean(mobile);
  }

  const newSlug = config.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const newFilename = `${newSlug}.json`;
  const newFilePath = path.join(__dirname, '../config/pages', newFilename);
  config.path = `/${newSlug}`;

  if (newFilePath !== oldFilePath && fs.existsSync(newFilePath)) {
    return res.status(409).json({ error: `A page with slug "${newSlug}" already exists` });
  }

  fs.writeFileSync(newFilePath, JSON.stringify(config, null, 2));
  if (newFilePath !== oldFilePath) {
    fs.unlinkSync(oldFilePath);
    console.log(`[Config] Renamed page ${oldFilename} → ${newFilename}`);
  } else {
    console.log(`[Config] Updated page ${newFilename}`);
  }

  const idx = pageConfigs.findIndex(p => p.path === `/${req.params.slug}`);
  if (idx !== -1) pageConfigs[idx] = config;

  res.json(config);
});

// Delete a page config file
app.delete('/api/pages/:slug', (req, res) => {
  const filename = `${req.params.slug}.json`;
  const filePath = path.join(__dirname, '../config/pages', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  fs.unlinkSync(filePath);
  console.log(`[Config] Deleted page: ${filename}`);
  res.status(204).end();
});

// Update a specific card in a page config
app.put('/api/pages/:slug/cards/:index', (req, res) => {
  const filename = `${req.params.slug}.json`;
  const filePath = path.join(__dirname, '../config/pages', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= config.cards.length) {
    return res.status(400).json({ error: 'Invalid card index' });
  }
  config.cards[index] = req.body;
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`[Config] Updated card ${index} in ${filename}`);
  res.json(config.cards[index]);
});

// Add a new card to a page config
app.post('/api/pages/:slug/cards', (req, res) => {
  const filename = `${req.params.slug}.json`;
  const filePath = path.join(__dirname, '../config/pages', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  config.cards.push(req.body);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`[Config] Added card to ${filename}`);
  res.status(201).json(req.body);
});

// Delete a specific card from a page config
app.delete('/api/pages/:slug/cards/:index', (req, res) => {
  const filename = `${req.params.slug}.json`;
  const filePath = path.join(__dirname, '../config/pages', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }
  const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= config.cards.length) {
    return res.status(400).json({ error: 'Invalid card index' });
  }
  config.cards.splice(index, 1);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`[Config] Deleted card ${index} from ${filename}`);
  res.status(204).end();
});

// MQTT config endpoints
app.get('/api/mqtt', (req, res) => {
  res.json(loadMqttConfig());
});

app.patch('/api/mqtt', (req, res) => {
  const allowed = ['broker_url', 'client_id', 'username', 'password', 'reconnect_period_ms', 'connect_timeout_ms', 'clean_session'];
  const current = loadMqttConfig();
  for (const key of allowed) {
    if (req.body[key] !== undefined) current[key] = req.body[key];
  }
  saveMqttConfig(current);
  mqttClient.reconfigure(current);
  console.log('[Config] MQTT settings updated');
  res.json(current);
});

app.post('/api/mqtt/publish', (req, res) => {
  const { topic, payload } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  mqttClient.publish(topic, payload ?? '');
  res.json({ ok: true });
});

// Weather proxy — met.no requires User-Agent header; cache 10 minutes
const weatherCache = new Map();

app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  const key = `${lat},${lon}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() < cached.expires) return res.json(cached.data);
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'MQTT-Layout/1.0 (home dashboard)' },
    });
    if (!r.ok) return res.status(r.status).json({ error: `met.no returned ${r.status}` });
    const data = await r.json();
    weatherCache.set(key, { data, expires: Date.now() + 10 * 60 * 1000 });
    res.json(data);
  } catch (err) {
    console.error('[Weather] Fetch failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Camera MJPEG proxy — transcodes RTSP/RTSPS to MJPEG via ffmpeg
app.get('/api/camera/stream', handleCameraStream);
app.get('/api/camera/snapshot', handleCameraSnapshot);
app.use('/api/recipes', recipeRoutes);

// WLED devices JSON — read/write
const wledDevicesPath = path.join(__dirname, '../config/wled_devices.json');
function loadWledDevices() {
  try { return JSON.parse(fs.readFileSync(wledDevicesPath, 'utf-8')); } catch { return []; }
}
app.get('/api/wled-devices', (req, res) => res.json(loadWledDevices()));
app.patch('/api/wled-devices', (req, res) => {
  try {
    fs.writeFileSync(wledDevicesPath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Colors JSON — read/write
const colorsPath = path.join(__dirname, '../config/colors.json');
app.get('/api/colors', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(colorsPath, 'utf-8'));
    res.json(data);
  } catch {
    res.json({ categories: [], presets: [] });
  }
});
app.patch('/api/colors', (req, res) => {
  try {
    fs.writeFileSync(colorsPath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// URLs JSON — read/write
const urlsPath = path.join(__dirname, '../config/urls.json');
app.get('/api/urls', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(urlsPath, 'utf-8'));
    res.json(data);
  } catch {
    res.json([]);
  }
});
app.patch('/api/urls', (req, res) => {
  try {
    fs.writeFileSync(urlsPath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WiiM / LinkPlay proxy — avoids CORS; uses HTTPS with self-signed cert
const wiimAgent = new https.Agent({ rejectUnauthorized: false });
app.get('/api/wiim/proxy', (req, res) => {
  const { ip, cmd } = req.query;
  if (!ip || !cmd) return res.status(400).json({ error: 'Missing ip or cmd' });
  const request = https.request(
    `https://${ip}/httpapi.asp?command=${cmd}`,
    { agent: wiimAgent },
    (upstream) => {
      let body = '';
      upstream.on('data', chunk => { body += chunk; });
      upstream.on('end', () => {
        try { res.json(JSON.parse(body)); } catch { res.send(body); }
      });
    }
  );
  request.on('error', e => res.status(503).json({ error: e.message }));
  request.end();
});

// Home Assistant service proxy — keeps the HA token off the browser
app.post('/api/ha/service/:domain/:service', async (req, res) => {
  const ha = loadHaConfig();
  if (!ha.url || !ha.token) {
    return res.status(503).json({ error: 'Home Assistant not configured' });
  }
  const url = `${ha.url}/api/services/${req.params.domain}/${req.params.service}`;
  try {
    const haRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ha.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const text = await haRes.text();
    res.status(haRes.status).send(text);
  } catch (err) {
    console.error('[HA] Service call failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Serve compiled frontend in production
const distPath = path.join(__dirname, '../frontend/dist');

// Serve WASM binary — gzip for Chrome (fast), raw for Safari (Safari misreads gzip stream size)
app.get('/guiv2/venus-gui-v2.wasm', (req, res) => {
  res.set('Content-Type', 'application/wasm');
  const ua = req.headers['user-agent'] || '';
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');
  if (isSafari) {
    res.sendFile(path.join(distPath, 'guiv2/venus-gui-v2.wasm'));
  } else {
    res.set('Content-Encoding', 'gzip');
    res.sendFile(path.join(distPath, 'guiv2/venus-gui-v2.wasm.gz'));
  }
});

app.use(express.static(distPath));

// SPA fallback — all non-API routes return index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Create WebSocket server (noServer mode — upgrade routing handled below)
const wsServer = createWsServer();

// ── Notification events persistence ───────────────────────────────────────
const EVENTS_FILE = path.join(__dirname, '../config/notification_events.json');
function loadEvents() { try { return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8')); } catch { return []; } }
function saveEvents(e) { fs.writeFileSync(EVENTS_FILE, JSON.stringify(e, null, 2)); }
let notifEvents = loadEvents();
console.log(`[Events] Loaded ${notifEvents.length} notification event(s)`);

app.get('/api/notification_events', (_req, res) => res.json(notifEvents));

app.post('/api/notification_events', (req, res) => {
  const { title = '', mqtt_topic = '', condition = '>', value = '' } = req.body ?? {};
  const event = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, mqtt_topic, condition, value };
  notifEvents = [...notifEvents, event];
  saveEvents(notifEvents);
  // subscribe to the new topic
  if (mqtt_topic) mqttClient?.subscribeTopics([mqtt_topic]);
  res.status(201).json(event);
});

app.put('/api/notification_events/:id', (req, res) => {
  const idx = notifEvents.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  notifEvents[idx] = { ...notifEvents[idx], ...req.body, id: req.params.id };
  saveEvents(notifEvents);
  if (notifEvents[idx].mqtt_topic) mqttClient?.subscribeTopics([notifEvents[idx].mqtt_topic]);
  res.json(notifEvents[idx]);
});

app.delete('/api/notification_events/:id', (req, res) => {
  notifEvents = notifEvents.filter(e => e.id !== req.params.id);
  saveEvents(notifEvents);
  res.status(204).end();
});

// ── Notification log persistence ──────────────────────────────────────────
const NOTIF_LOG_FILE = path.join(__dirname, '../config/notifications.json');
const MAX_NOTIF_LOG  = 500;

function loadNotifLog() {
  try { return JSON.parse(fs.readFileSync(NOTIF_LOG_FILE, 'utf-8')); } catch { return []; }
}
function saveNotifLog(log) {
  fs.writeFileSync(NOTIF_LOG_FILE, JSON.stringify(log, null, 2));
}

let notifLog = loadNotifLog();
console.log(`[Notifications] Loaded ${notifLog.length} log entries`);

app.get('/api/notifications', (_req, res) => res.json(notifLog));

// Push a notification to all connected dashboard clients
app.post('/api/notifications', (req, res) => {
  const { title = '', message = '', level = 'info', sound1 = '', sound2 = '', icon = '' } = req.body ?? {};
  if (!title && !message) return res.status(400).json({ error: 'title or message required' });
  const notification = {
    type: 'notification',
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    message,
    level,
    icon,
    sound1,
    sound2,
    timestamp: Date.now(),
  };
  // Persist: prepend, cap, save
  notifLog = [notification, ...notifLog].slice(0, MAX_NOTIF_LOG);
  saveNotifLog(notifLog);
  wsServer.broadcast(notification);
  res.json({ ok: true, notification });
});

const VICTRON_HOSTS = {
  '/victron1-mqtt': { host: '192.168.0.10', port: 9001 },
  '/victron2-mqtt': { host: '192.168.0.60', port: 9001 },
};

function victronTcpTunnel(req, socket, head, host, port) {
  const upstream = net.connect(port, host);

  socket.on('error', () => upstream.destroy());
  upstream.on('error', (err) => {
    console.error(`[Victron] TCP error (${host}:${port}):`, err.message);
    socket.destroy();
  });
  socket.on('close', () => upstream.destroy());
  upstream.on('close', () => socket.destroy());

  upstream.on('connect', () => {
    // Forward the HTTP upgrade request to the Victron device, rewriting path to /
    const lines = [`GET / HTTP/1.1`, `Host: ${host}:${port}`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() !== 'host') lines.push(`${k}: ${v}`);
    }
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length > 0) upstream.write(head);

    // Wait for the 101 response from the Victron device
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const end = buf.indexOf('\r\n\r\n');
      if (end === -1) return;
      upstream.removeListener('data', onData);
      // Forward the 101 response to the browser
      socket.write(buf.subarray(0, end + 4));
      // Forward any data that arrived after the headers
      const leftover = buf.subarray(end + 4);
      if (leftover.length > 0) socket.write(leftover);
      // Raw pipe in both directions
      socket.pipe(upstream);
      upstream.pipe(socket);
      console.log(`[Victron] tunnel active: ${host}:${port}`);
    };
    upstream.on('data', onData);
  });
}

httpServer.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/ws') {
    wsServer.handleUpgrade(req, socket, head, (ws) => {
      wsServer.emit('connection', ws, req);
    });
  } else if (VICTRON_HOSTS[pathname]) {
    const { host, port } = VICTRON_HOSTS[pathname];
    victronTcpTunnel(req, socket, head, host, port);
  } else {
    socket.destroy();
  }
});

// ── MQTT event trigger ────────────────────────────────────────────────────
const topicLastValues = new Map();  // topic → last numeric value seen

function checkEventTriggers(topic, value) {
  const prev = topicLastValues.get(topic);  // undefined on first message
  topicLastValues.set(topic, value);

  // Skip first message — no previous value to compare against
  if (prev === undefined) return;

  const num     = parseFloat(value);
  const prevNum = parseFloat(prev);
  const now     = Date.now();

  for (const ev of notifEvents) {
    if (ev.mqtt_topic !== topic) continue;

    let triggered = false;

    if (ev.condition === '=') {
      // String edge: fires when value transitions TO the target
      const target = String(ev.value ?? '').trim();
      triggered = (String(value).trim() === target) && (String(prev).trim() !== target);
    } else {
      // Numeric edge: only process if both values are numbers
      if (isNaN(num) || isNaN(prevNum)) continue;
      const threshold = parseFloat(ev.value);
      if (isNaN(threshold)) continue;

      triggered = ev.condition === '>'
        ? (prevNum <= threshold && num > threshold)   // crossed upward
        : (prevNum >= threshold && num < threshold);  // crossed downward
    }

    if (!triggered) continue;

    // Look up the linked notification rule from any notification card
    let linkedNotif = null;
    if (ev.notification_title) {
      for (const page of pageConfigs) {
        for (const card of (page.cards ?? [])) {
          if (card.type !== 'notification') continue;
          const found = (card.items ?? []).find(i => i.title === ev.notification_title);
          if (found) { linkedNotif = found; break; }
        }
        if (linkedNotif) break;
      }
    }

    const notification = {
      type:      'notification',
      id:        now.toString(36) + Math.random().toString(36).slice(2, 6),
      title:     linkedNotif?.title  || ev.title,
      message:   linkedNotif?.notification_text || `${topic} = ${value} (${ev.condition} ${ev.value})`,
      level:     'warning',
      icon:      linkedNotif?.icon   || '',
      sound1:    linkedNotif?.sound1 || '',
      sound2:    linkedNotif?.sound2 || '',
      timestamp: now,
    };
    notifLog = [notification, ...notifLog].slice(0, MAX_NOTIF_LOG);
    saveNotifLog(notifLog);
    wsServer.broadcast(notification);
    console.log(`[Events] Triggered "${ev.title}" (${topic} ${ev.condition} ${ev.value})`);
  }
}

// Create MQTT client and wire it to the WebSocket server
const mqttClient = createMqttClient(pageConfigs, wsServer, checkEventTriggers);

// Subscribe to all event topics and WLED topics after client is created
setTimeout(() => {
  const eventTopics = [...new Set(notifEvents.map(e => e.mqtt_topic).filter(Boolean))];
  if (eventTopics.length) mqttClient.subscribeTopics(eventTopics);
  if (loadWledDevices().length) mqttClient.subscribeTopics(['wled/#']);
}, 2000);

const PORT = process.env.SERVER_PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
});

// Watch config/pages for changes and refresh subscriptions
const configDir = path.join(__dirname, '../config/pages');
let debounceTimer = null;
fs.watch(configDir, (_eventType, filename) => {
  if (!filename?.endsWith('.json')) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`[Config] Change detected in ${filename}, reloading...`);
    try {
      pageConfigs = loadAllPageConfigs();
      console.log(`[Config] Loaded ${pageConfigs.length} page(s): ${pageConfigs.map(p => p.name).join(', ')}`);
      mqttClient.refresh(pageConfigs);
    } catch (err) {
      console.error('[Config] Reload failed:', err.message);
    }
  }, 300);
});
