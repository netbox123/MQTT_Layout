import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAVORITES_PATH = path.join(__dirname, '../config/iptv_favorites.json');
const API_BASE = 'https://iptv-org.github.io/api';
const REFRESH_MS = 24 * 60 * 60 * 1000;

function loadFavorites() {
  try { return JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf-8')); } catch { return []; }
}
function saveFavorites(list) {
  fs.writeFileSync(FAVORITES_PATH, JSON.stringify(list, null, 2));
}

let cache = { channels: [], countries: [], categories: [], byId: new Map() };

async function fetchJson(name) {
  const res = await fetch(`${API_BASE}/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json → ${res.status}`);
  return res.json();
}

async function refreshCache() {
  const [channels, streams, countries, categories, logos] = await Promise.all([
    fetchJson('channels'), fetchJson('streams'), fetchJson('countries'),
    fetchJson('categories'), fetchJson('logos'),
  ]);

  const countryById = new Map(countries.map(c => [c.code, c]));
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const logoById = new Map();
  for (const l of logos) if (!logoById.has(l.channel)) logoById.set(l.channel, l.url);

  const streamsByChannel = new Map();
  for (const s of streams) {
    if (!s.channel) continue;
    if (!streamsByChannel.has(s.channel)) streamsByChannel.set(s.channel, []);
    streamsByChannel.get(s.channel).push({
      url: s.url, quality: s.quality, label: s.label,
      user_agent: s.user_agent, referrer: s.referrer,
    });
  }

  const joined = [];
  for (const ch of channels) {
    if (ch.is_nsfw) continue;
    const chStreams = streamsByChannel.get(ch.id);
    if (!chStreams?.length) continue;
    const country = countryById.get(ch.country);
    joined.push({
      id: ch.id,
      name: ch.name,
      country: ch.country,
      countryName: country?.name ?? ch.country,
      flag: country?.flag ?? '',
      categoryIds: ch.categories ?? [],
      categories: (ch.categories ?? []).map(id => categoryById.get(id)?.name ?? id),
      logo: logoById.get(ch.id) ?? '',
      streams: chStreams,
    });
  }
  joined.sort((a, b) => a.name.localeCompare(b.name));

  cache = {
    channels: joined,
    countries: countries
      .filter(c => joined.some(ch => ch.country === c.code))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
    byId: new Map(joined.map(ch => [ch.id, ch])),
  };
  console.log(`[IPTV] Cache refreshed: ${joined.length} channels`);
}

refreshCache().catch(err => console.error('[IPTV] Initial cache load failed:', err.message));
setInterval(() => refreshCache().catch(err => console.error('[IPTV] Cache refresh failed:', err.message)), REFRESH_MS);

const router = express.Router();

router.get('/channels', (_req, res) => res.json(cache.channels));
router.get('/countries', (_req, res) => res.json(cache.countries));
router.get('/categories', (_req, res) => res.json(cache.categories));

router.get('/favorites', (_req, res) => res.json(loadFavorites()));
router.patch('/favorites', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body must be an array of channel ids' });
  saveFavorites(req.body);
  res.json({ ok: true });
});

// ── HLS relay proxy ─────────────────────────────────────────────────────
// Resolves channel/stream index server-side (never proxies an arbitrary
// client-supplied URL) so this can't be used as an open relay.
function resolveTarget(req) {
  const { channel, stream, path: relPath } = req.query;
  const ch = cache.byId.get(channel);
  if (!ch) return null;
  const streamEntry = ch.streams[Number(stream)];
  if (!streamEntry) return null;
  if (relPath) {
    return {
      url: new URL(relPath, streamEntry.url).toString(),
      user_agent: streamEntry.user_agent,
      referrer: streamEntry.referrer,
    };
  }
  return { url: streamEntry.url, user_agent: streamEntry.user_agent, referrer: streamEntry.referrer };
}

function proxyUrlFor(req, baseUrl, uri) {
  const resolved = new URL(uri, baseUrl).toString();
  const params = new URLSearchParams({
    channel: req.query.channel,
    stream: req.query.stream,
    path: resolved,
  });
  return `/api/iptv/stream?${params.toString()}`;
}

router.get('/stream', async (req, res) => {
  const target = resolveTarget(req);
  if (!target) return res.status(404).end();

  const headers = {};
  if (target.user_agent) headers['User-Agent'] = target.user_agent;
  if (target.referrer) headers['Referer'] = target.referrer;

  let upstream;
  try {
    upstream = await fetch(target.url, { headers });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
  if (!upstream.ok) return res.status(upstream.status).end();

  const contentType = upstream.headers.get('content-type') || '';
  const isPlaylist = contentType.includes('mpegurl') || target.url.endsWith('.m3u8');

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      return proxyUrlFor(req, target.url, trimmed);
    }).join('\n');
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    return res.send(rewritten);
  }

  res.set('Content-Type', contentType || 'video/mp2t');
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
});

export default router;
