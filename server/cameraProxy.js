import { spawn } from 'child_process';
import http from 'http';
import https from 'https';

const BOUNDARY = 'mjpegframe';
const WATCHDOG_INTERVAL = 10_000;  // check every 10 s
const FRAME_TIMEOUT    = 10_000;  // restart if no frame in 10 s
const RESTART_DELAY    =  3_000;  // wait 3 s before restarting

// Active streams keyed by url — each entry holds the ffmpeg process and a set of response objects
const activeStreams = new Map();

function startFfmpeg(url) {
  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-i', url,
    '-vf', 'fps=5,scale=640:-1',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', '5',
    'pipe:1',
  ]);

  const entry = {
    ffmpeg,
    clients: new Set(),
    buffer: Buffer.alloc(0),
    lastFrameAt: Date.now(),
    watchdog: null,
    restarting: false,
  };
  activeStreams.set(url, entry);

  // ── Watchdog ──────────────────────────────────────────────────────────────
  entry.watchdog = setInterval(() => {
    if (entry.clients.size === 0) return;
    if (Date.now() - entry.lastFrameAt > FRAME_TIMEOUT) {
      console.log(`[Camera] Watchdog: no frames for ${url}, restarting…`);
      restartStream(url);
    }
  }, WATCHDOG_INTERVAL);

  ffmpeg.stdout.on('data', (chunk) => {
    entry.buffer = Buffer.concat([entry.buffer, chunk]);
    // Extract complete JPEG frames (FF D8 ... FF D9) and broadcast
    let start = -1;
    for (let i = 0; i < entry.buffer.length - 1; i++) {
      if (entry.buffer[i] === 0xFF && entry.buffer[i + 1] === 0xD8) {
        start = i;
      } else if (start !== -1 && entry.buffer[i] === 0xFF && entry.buffer[i + 1] === 0xD9) {
        const frame = entry.buffer.subarray(start, i + 2);
        entry.buffer = entry.buffer.subarray(i + 2);
        i = -1; // restart scan on remaining buffer
        entry.lastFrameAt = Date.now();
        const header = `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
        for (const res of entry.clients) {
          try {
            res.write(header);
            res.write(frame);
            res.write('\r\n');
          } catch {
            entry.clients.delete(res);
          }
        }
        start = -1;
      }
    }
    // Keep only unprocessed tail
    if (start !== -1) {
      entry.buffer = entry.buffer.subarray(start);
    } else if (entry.buffer.length > 1024 * 512) {
      entry.buffer = Buffer.alloc(0); // discard runaway buffer
    }
  });

  ffmpeg.stderr.on('data', () => {
    // suppress ffmpeg log noise; change to: process.stderr.write('[ffmpeg] ' + d) to debug
  });

  ffmpeg.on('error', (err) => {
    console.error(`[Camera] ffmpeg error for ${url}: ${err.message}`);
    cleanupEntry(url);
  });

  ffmpeg.on('close', (code) => {
    const e = activeStreams.get(url);
    if (!e || e.restarting) return;
    console.log(`[Camera] ffmpeg closed (code ${code}) for ${url}`);
    if (e.clients.size > 0) {
      console.log(`[Camera] Auto-restarting stream for ${url} (${e.clients.size} viewer(s))`);
      restartStream(url);
    } else {
      cleanupEntry(url);
    }
  });

  return entry;
}

function cleanupEntry(url) {
  const e = activeStreams.get(url);
  if (!e) return;
  clearInterval(e.watchdog);
  for (const res of e.clients) { try { res.end(); } catch { /* ignore */ } }
  activeStreams.delete(url);
}

function restartStream(url) {
  const e = activeStreams.get(url);
  if (!e || e.restarting) return;
  e.restarting = true;
  clearInterval(e.watchdog);

  // Kill current ffmpeg
  try { e.ffmpeg.kill('SIGTERM'); } catch { /* ignore */ }

  // Preserve clients across restart
  const clients = new Set(e.clients);
  activeStreams.delete(url);

  setTimeout(() => {
    console.log(`[Camera] Restarting ffmpeg for ${url}`);
    const newEntry = startFfmpeg(url);
    // Re-attach existing clients to the new stream
    for (const res of clients) {
      if (!res.writableEnded) {
        newEntry.clients.add(res);
      }
    }
    console.log(`[Camera] Stream restarted, ${newEntry.clients.size} viewer(s) re-attached`);
  }, RESTART_DELAY);
}

export function handleCameraSnapshot(req, res) {
  const url = req.query.url;
  if (!url || !/^rtsps?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'url must be an rtsp:// or rtsps:// address' });
  }
  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-i', url,
    '-vframes', '1',
    '-f', 'image2',
    '-vcodec', 'mjpeg',
    'pipe:1',
  ]);
  const chunks = [];
  ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
  ffmpeg.on('close', (code) => {
    if (code === 0 && chunks.length > 0) {
      const img = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(img);
    } else {
      if (!res.headersSent) res.status(502).end();
    }
  });
  ffmpeg.on('error', (err) => {
    if (!res.headersSent) res.status(503).json({ error: err.message });
  });
  req.on('close', () => ffmpeg.kill('SIGTERM'));
}

function proxyHttpStream(url, res) {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, (upstream) => {
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'multipart/x-mixed-replace');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.pipe(res);
    res.on('close', () => req.destroy());
  });
  req.on('error', (err) => {
    if (!res.headersSent) res.status(502).json({ error: err.message });
    else res.end();
  });
}

export function handleCameraStream(req, res) {
  const url = req.query.url;
  if (!url || !/^(rtsps?|https?):\/\//i.test(url)) {
    return res.status(400).json({ error: 'url must be an rtsp://, rtsps://, http://, or https:// address' });
  }

  if (/^https?:\/\//i.test(url)) {
    return proxyHttpStream(url, res);
  }

  res.setHeader('Content-Type', `multipart/x-mixed-replace; boundary=${BOUNDARY}`);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // send headers immediately so the browser holds the connection open

  let entry = activeStreams.get(url);
  if (!entry) {
    try {
      entry = startFfmpeg(url);
    } catch (err) {
      return res.status(503).json({ error: 'ffmpeg not available: ' + err.message });
    }
  }

  entry.clients.add(res);
  console.log(`[Camera] Client connected to ${url}. Viewers: ${entry.clients.size}`);

  req.on('close', () => {
    const e = activeStreams.get(url);
    if (!e) return;
    e.clients.delete(res);
    console.log(`[Camera] Client disconnected from ${url}. Viewers: ${e.clients.size}`);
    if (e.clients.size === 0 && !e.restarting) {
      clearInterval(e.watchdog);
      e.ffmpeg.kill('SIGTERM');
      activeStreams.delete(url);
      console.log(`[Camera] Stopped stream for ${url}`);
    }
  });
}
