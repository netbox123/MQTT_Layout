import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'history.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY, topic TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS history (topic_id INTEGER NOT NULL, ts INTEGER NOT NULL, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_history_topic_ts ON history(topic_id, ts);
`);

const getTopicId = db.prepare('SELECT id FROM topics WHERE topic = ?');
const insertTopic = db.prepare('INSERT OR IGNORE INTO topics (topic) VALUES (?)');
const insertHistory = db.prepare('INSERT INTO history (topic_id, ts, value) VALUES (?, ?, ?)');
const selectHistory = db.prepare(`
  SELECT h.ts, h.value FROM history h
  JOIN topics t ON t.id = h.topic_id
  WHERE t.topic = ? AND h.ts >= ?
  ORDER BY h.ts ASC
`);

// topic -> last stored value (string), so most incoming MQTT messages
// (unchanged/rounded-away noise) never touch the database at all.
const lastValues = new Map();

function roundToStep(num, roundStep) {
  const rounded = Math.round(num / roundStep) * roundStep;
  return String(Number(rounded.toFixed(6))); // trim float noise, e.g. 23.000000000000004
}

function writeRow(topic, value) {
  let row = getTopicId.get(topic);
  if (!row) {
    insertTopic.run(topic);
    row = getTopicId.get(topic);
  }
  insertHistory.run(row.id, Date.now(), value);
}

export function record(topic, rawValue, roundStep) {
  const last = lastValues.get(topic);
  const num = Number(rawValue);

  if (roundStep && !Number.isNaN(num)) {
    // Hysteresis: a value sitting right on a rounding-bucket boundary will
    // otherwise flip back and forth on ordinary sensor noise (e.g. raw
    // hovering at 9.0 with round=2 alternates between the "8" and "10"
    // buckets on every tiny wobble). Require the raw value to move a full
    // step away from the currently-stored bucket before accepting a new one.
    if (last !== undefined && Math.abs(num - Number(last)) < roundStep) return;
    const value = roundToStep(num, roundStep);
    if (value === last) return;
    lastValues.set(topic, value);
    writeRow(topic, value);
    return;
  }

  // no rounding configured, or a non-numeric (state) value — plain change detection
  if (last === rawValue) return;
  lastValues.set(topic, rawValue);
  writeRow(topic, rawValue);
}

export function query(topic, sinceMs) {
  return selectHistory.all(topic, sinceMs);
}
