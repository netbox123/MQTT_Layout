import { useMqttStore } from '../stores/mqttStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

let socket = null;
let reconnectTimer = null;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      window.location.reload();
    }
  }
});

export function useMqtt() {
  const mqttStore = useMqttStore();
  const notificationStore = useNotificationStore();

  function connect() {
    if (socket && socket.readyState <= WebSocket.OPEN) return;

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
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'mqtt_status') {
          mqttStore.setStatus(msg.status);
        } else if (msg.type === 'notification') {
          notificationStore.add(msg);
        } else if (msg.topic !== undefined) {
          mqttStore.setTopicValue(msg.topic, msg.value);
        }
      } catch {
        console.warn('[WS] Unparseable message:', event.data);
      }
    };

    socket.onclose = () => {
      mqttStore.setStatus('disconnected');
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimer = setTimeout(connect, 3000);
    };

    socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      socket.close();
    };
  }

  function publish(topic, value) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'publish', topic, value }));
    } else {
      console.warn('[WS] Cannot publish — not connected');
    }
  }

  return { connect, publish };
}
