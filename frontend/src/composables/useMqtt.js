import { useMqttStore } from '../stores/mqttStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

let socket = null;
let reconnectTimer = null;
let heartbeatInterval = null;
let pongTimeout = null;
let awaitingPong = false;

const HEARTBEAT_INTERVAL_MS = 15000;
const PONG_TIMEOUT_MS = 5000;

function connect() {
  if (socket && socket.readyState <= WebSocket.OPEN) return;

  const mqttStore = useMqttStore();
  const notificationStore = useNotificationStore();

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;

  socket = new WebSocket(wsUrl);
  mqttStore.setStatus('connecting');

  socket.onopen = () => {
    // Status stays 'connecting' until server sends mqtt_status
    console.log('[WS] Connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    clearHeartbeat();
    heartbeatInterval = setInterval(sendPing, HEARTBEAT_INTERVAL_MS);
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'pong') {
        awaitingPong = false;
        if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
      } else if (msg.type === 'mqtt_status') {
        mqttStore.setStatus(msg.status);
      } else if (msg.type === 'notification') {
        notificationStore.add(msg);
      } else if (msg.type === 'scene-trigger') {
        window.dispatchEvent(new CustomEvent('scene-trigger', { detail: { scene_id: msg.scene_id, auto: msg.auto } }));
      } else if (msg.type === 'scene-state') {
        window.dispatchEvent(new CustomEvent('scene-state', { detail: msg }));
      } else if (msg.topic !== undefined) {
        mqttStore.setTopicValue(msg.topic, msg.value);
        if (msg.topic.startsWith('ir/') && msg.topic.endsWith('/learned')) {
          window.dispatchEvent(new CustomEvent('ir-learned', { detail: { topic: msg.topic, value: msg.value } }));
        }
      }
    } catch {
      console.warn('[WS] Unparseable message:', event.data);
    }
  };

  socket.onclose = () => {
    clearHeartbeat();
    mqttStore.setStatus('disconnected');
    console.log('[WS] Disconnected, reconnecting in 3s...');
    reconnectTimer = setTimeout(connect, 3000);
  };

  socket.onerror = (err) => {
    console.error('[WS] Error:', err);
    socket.close();
  };
}

// A WebSocket can look OPEN in readyState while the underlying connection is
// actually dead (e.g. after the laptop slept) — the browser only notices once
// it tries to send/receive. So we probe with an app-level ping/pong instead of
// trusting readyState, and force-close if no pong comes back in time.
function sendPing() {
  if (!socket || socket.readyState !== WebSocket.OPEN || awaitingPong) return;
  awaitingPong = true;
  socket.send(JSON.stringify({ type: 'ping' }));
  pongTimeout = setTimeout(() => {
    console.warn('[WS] No pong received — connection is dead, forcing reconnect');
    awaitingPong = false;
    socket?.close();
  }, PONG_TIMEOUT_MS);
}

function clearHeartbeat() {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
  awaitingPong = false;
}

function checkConnection() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect();
  } else {
    sendPing();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkConnection();
});
window.addEventListener('focus', checkConnection);
window.addEventListener('online', checkConnection);

export function useMqtt() {
  function publish(topic, value, { retain = false } = {}) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'publish', topic, value, retain }));
    } else {
      console.warn('[WS] Cannot publish — not connected');
    }
  }

  return { connect, publish };
}
