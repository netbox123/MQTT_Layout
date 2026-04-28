import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '../config/pages');

export function loadAllPageConfigs() {
  if (!fs.existsSync(CONFIG_DIR)) {
    console.warn(`Config directory not found: ${CONFIG_DIR}`);
    return [];
  }

  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));

  return files.map(file => {
    const filePath = path.join(CONFIG_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(raw);

    if (!config.name || !config.path || !Array.isArray(config.cards)) {
      throw new Error(`Invalid config in ${file}: requires name, path, and cards[]`);
    }

    return config;
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function extractAllTopics(pageConfigs) {
  const topics = new Set();
  for (const page of pageConfigs) {
    for (const card of page.cards) {
      if (card.mqtt_topic) topics.add(card.mqtt_topic);
      if (card.command_topic) topics.add(card.command_topic);
      for (const item of card.items ?? []) {
        if (item.mqtt_topic) topics.add(item.mqtt_topic);
      }
      if ((card.type === 'machine' || card.type === 'tv') && card.mqtt_prefix) {
        topics.add(`${card.mqtt_prefix}/+/online`);
        topics.add(`${card.mqtt_prefix}/+/state`);
      }
    }
  }
  return [...topics];
}
