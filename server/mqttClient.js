import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractAllTopics } from './configLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath = path.join(__dirname, '../config/mqtt.json');

export function loadMqttConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.warn('[MQTT] Could not load config/mqtt.json, using defaults');
    return {};
  }
}

export function saveMqttConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

export function createMqttClient(pageConfigs, wsServer, onMessage = null) {
  let activeTopics = new Set(extractAllTopics(pageConfigs));
  let currentClient = null;

  function buildOptions(cfg) {
    const opts = {
      clientId:        cfg.client_id         || undefined,
      reconnectPeriod: cfg.reconnect_period_ms ?? 5000,
      connectTimeout:  cfg.connect_timeout_ms  ?? 10000,
      clean:           cfg.clean_session       ?? true,
    };
    if (cfg.username) opts.username = cfg.username;
    if (cfg.password) opts.password = cfg.password;
    return opts;
  }

  function subscribeAll(client, topicSet) {
    const arr = [...topicSet];
    if (arr.length === 0) return;
    client.subscribe(arr, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err);
      else console.log(`[MQTT] Subscribed to ${arr.length} topics`);
    });
  }

  function wireClient(client, brokerUrl) {
    client.on('connect', () => {
      console.log(`[MQTT] Connected to ${brokerUrl}`);
      wsServer.broadcast({ type: 'mqtt_status', status: 'connected' });
      subscribeAll(client, activeTopics);
    });
    client.on('message', (topic, messageBuffer) => {
      const value = messageBuffer.toString();
      wsServer.broadcast({ topic, value });
      if (onMessage) onMessage(topic, value);
    });
    client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...');
      wsServer.broadcast({ type: 'mqtt_status', status: 'connecting' });
    });
    client.on('error', (err) => {
      console.error('[MQTT] Error:', err.message);
      wsServer.broadcast({ type: 'mqtt_status', status: 'disconnected' });
    });
    client.on('offline', () => {
      console.warn('[MQTT] Client offline');
      wsServer.broadcast({ type: 'mqtt_status', status: 'disconnected' });
    });
    client.on('close', () => {
      wsServer.broadcast({ type: 'mqtt_status', status: 'disconnected' });
    });
  }

  function connect(cfg) {
    const brokerUrl = cfg.broker_url || 'mqtt://localhost:1883';
    const client = mqtt.connect(brokerUrl, buildOptions(cfg));
    wireClient(client, brokerUrl);
    currentClient = client;
    return client;
  }

  // Initial connection
  connect(loadMqttConfig());

  // Handle publish requests from the frontend (switches, buttons)
  wsServer.on('frontend_publish', ({ topic, value }) => {
    if (currentClient?.connected) {
      currentClient.publish(topic, String(value), { retain: false });
      console.log(`[MQTT] Published to ${topic}: ${value}`);
    } else {
      console.warn('[MQTT] Cannot publish — not connected');
    }
  });

  return {
    refresh(newPageConfigs) {
      const newTopics = new Set(extractAllTopics(newPageConfigs));
      const toUnsub = [...activeTopics].filter(t => !newTopics.has(t));
      const toSub   = [...newTopics].filter(t => !activeTopics.has(t));

      if (toUnsub.length > 0) {
        currentClient.unsubscribe(toUnsub, (err) => {
          if (err) console.error('[MQTT] Unsubscribe error:', err);
          else console.log(`[MQTT] Unsubscribed from ${toUnsub.length} topics`);
        });
      }
      if (toSub.length > 0) {
        currentClient.subscribe(toSub, (err) => {
          if (err) console.error('[MQTT] Subscribe error:', err);
          else console.log(`[MQTT] Subscribed to ${toSub.length} new topics`);
        });
      }
      if (toUnsub.length === 0 && toSub.length === 0) {
        console.log('[MQTT] Subscriptions unchanged');
      }
      activeTopics = newTopics;
    },

    reconfigure(newCfg) {
      currentClient.end(true, () => {
        console.log('[MQTT] Disconnected, reconnecting with new config...');
        connect(newCfg);
      });
    },

    publish(topic, payload) {
      if (currentClient?.connected) {
        currentClient.publish(topic, String(payload), { retain: false });
        console.log(`[MQTT] Published to ${topic}: ${payload}`);
      } else {
        console.warn('[MQTT] Cannot publish — not connected');
      }
    },

    subscribeTopics(topics) {
      if (!currentClient?.connected || topics.length === 0) return;
      const newOnes = topics.filter(t => !activeTopics.has(t));
      if (newOnes.length === 0) return;
      currentClient.subscribe(newOnes, (err) => {
        if (!err) {
          newOnes.forEach(t => activeTopics.add(t));
          console.log(`[MQTT] Subscribed to ${newOnes.length} event topic(s)`);
        }
      });
    },
  };
}
