import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOWS_DIR = path.join(__dirname, '../config/tows');

fs.mkdirSync(TOWS_DIR, { recursive: true });

function allTows() {
  return fs.readdirSync(TOWS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(TOWS_DIR, f), 'utf-8')))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

const router = express.Router();

router.get('/', (req, res) => res.json(allTows()));

export default router;
