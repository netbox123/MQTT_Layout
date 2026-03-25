import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

export function createWsServer() {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();
  const emitter = new EventEmitter();
  const topicCache = new Map();
  let mqttStatusCache = null;

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected from ${req.socket.remoteAddress}. Total: ${clients.size}`);

    // Send all known values to the new client immediately
    for (const [topic, value] of topicCache) {
      ws.send(JSON.stringify({ topic, value }));
    }
    // Send cached MQTT status so the client shows the correct state right away
    if (mqttStatusCache !== null) {
      ws.send(JSON.stringify({ type: 'mqtt_status', status: mqttStatusCache }));
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'publish' && msg.topic) {
          emitter.emit('frontend_publish', { topic: msg.topic, value: msg.value ?? '' });
        }
      } catch {
        console.warn('[WS] Invalid message from client:', data.toString());
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  wss.broadcast = (payload) => {
    if (payload.topic !== undefined) {
      topicCache.set(payload.topic, payload.value);
    }
    if (payload.type === 'mqtt_status') {
      mqttStatusCache = payload.status;
    }
    const message = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  };

  wss.on = emitter.on.bind(emitter);

  return wss;
}
