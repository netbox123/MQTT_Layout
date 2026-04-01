import { ref, shallowRef, readonly } from 'vue';

/**
 * Shared singleton — one WS connection per MA server URL.
 * Multiple card instances on the same page share it.
 */
const instances = new Map();

export function getMaInstances() { return [...instances.values()]; }

export function useMusicAssistant(maUrl, maToken) {
  const key = maUrl;
  if (instances.has(key)) return instances.get(key);

  // ── State ──────────────────────────────────────────────────────────────────
  const connected   = ref(false);
  const authed      = ref(false);
  const players     = ref([]);          // all players from players/all
  const queues      = shallowRef({});   // queue_id -> queue object
  const error       = ref('');

  let ws            = null;
  let msgId         = 1;
  const pending     = new Map();        // message_id -> { resolve, reject }
  let reconnectTimer = null;
  let pollTimer      = null;

  // ── Send ───────────────────────────────────────────────────────────────────
  function send(command, args = {}) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      const id = String(msgId++);
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ message_id: id, command, args }));
    });
  }

  // ── Commands ───────────────────────────────────────────────────────────────
  async function playPause(playerId)        { await send('players/cmd/play_pause', { player_id: playerId }); }
  async function next(playerId)             { await send('players/cmd/next',       { player_id: playerId }); }
  async function previous(playerId)         { await send('players/cmd/previous',   { player_id: playerId }); }
  async function setVolume(playerId, vol)   { await send('players/cmd/volume_set', { player_id: playerId, volume_level: Math.round(vol) }); }
  async function setShuffle(queueId, val)   { await send('player_queues/shuffle',  { queue_id: queueId, shuffle_enabled: val }); }
  async function setRepeat(queueId, mode)   { await send('player_queues/repeat',   { queue_id: queueId, repeat_mode: mode }); }
  async function seek(queueId, pos)         { await send('player_queues/seek',     { queue_id: queueId, seek_position: Math.round(pos) }); }
  async function getQueueItems(queueId, limit = 100, offset = 0) {
    return send('player_queues/items', { queue_id: queueId, limit, offset });
  }
  async function search(query, limit = 25) {
    return send('music/search', { search_query: query, limit });
  }
  async function playQueueItem(queueId, index) {
    return send('player_queues/play_index', { queue_id: queueId, index });
  }
  async function getRadioStations(limit = 200, offset = 0) {
    return send('music/radios/library_items', { limit, offset });
  }
  async function browse(path) {
    return send('music/browse', path ? { path } : {});
  }
  async function playMedia(queueId, media, option = 'play') {
    return send('player_queues/play_media', { queue_id: queueId, media, option });
  }
  async function playAnnouncement(playerId, url, volume = null) {
    const args = { player_id: playerId, url, use_pre_announce: false };
    if (volume !== null) args.volume_level = volume;
    return send('players/cmd/play_announcement', args);
  }

  // ── Init after auth ────────────────────────────────────────────────────────
  async function fetchAll() {
    const [ps, qs] = await Promise.all([
      send('players/all'),
      send('player_queues/all'),
    ]);
    if (ps) players.value = ps;
    if (qs) {
      const qmap = {};
      for (const q of qs) qmap[q.queue_id] = q;
      queues.value = qmap;
    }
  }

  async function init() {
    try {
      await fetchAll();
      clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try { await fetchAll(); } catch { /* ignore if WS not ready */ }
      }, 5000);
    } catch (e) {
      error.value = `Init failed: ${e.message}`;
    }
  }

  // ── Event handler ──────────────────────────────────────────────────────────
  function handleEvent(event) {
    const { data } = event;
    switch (event.event) {
      case 'player_updated':
      case 'player_added': {
        const idx = players.value.findIndex(p => p.player_id === data.player_id);
        if (idx >= 0) {
          const updated = [...players.value];
          updated[idx] = data;
          players.value = updated;
        } else {
          players.value = [...players.value, data];
        }
        break;
      }
      case 'player_removed':
        players.value = players.value.filter(p => p.player_id !== data);
        break;
      case 'queue_updated':
      case 'queue_added':
        queues.value = { ...queues.value, [data.queue_id]: data };
        break;
      case 'queue_time_updated': {
        const q = queues.value[data.queue_id];
        if (q) queues.value = { ...queues.value, [data.queue_id]: { ...q, elapsed_time: data.elapsed_time } };
        break;
      }
    }
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  function connect() {
    clearTimeout(reconnectTimer);
    if (ws) { try { ws.close(); } catch { /* ignore */ } }

    const isHttps = window.location.protocol === 'https:';
    const wsUrl = isHttps
      ? `wss://${window.location.host}/ma-proxy/ws`
      : maUrl.replace(/^http/, 'ws') + '/ws';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected.value = true;
      error.value = '';
    };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      // Server info (first message after connect)
      if ('server_id' in msg) {
        // Authenticate immediately
        try {
          await send('auth', { token: maToken });
          authed.value = true;
          await init();
        } catch (err) {
          error.value = `Auth failed: ${err.message}`;
        }
        return;
      }

      // Event
      if ('event' in msg) {
        handleEvent(msg);
        return;
      }

      // Result / error for a pending command
      if ('message_id' in msg && pending.has(msg.message_id)) {
        const { resolve, reject } = pending.get(msg.message_id);
        pending.delete(msg.message_id);
        if ('error_code' in msg) reject(new Error(msg.details ?? 'Command failed'));
        else resolve(msg.result);
      }
    };

    ws.onclose = () => {
      connected.value = false;
      authed.value = false;
      clearInterval(pollTimer);
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      error.value = 'WebSocket error';
    };
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        connect();
      }
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  connect();

  const api = {
    connected: readonly(connected),
    authed:    readonly(authed),
    players:   readonly(players),
    queues:    readonly(queues),
    error:     readonly(error),
    playPause, next, previous, setVolume, setShuffle, setRepeat, seek, getQueueItems, search, getRadioStations, browse, playMedia, playQueueItem, playAnnouncement,
  };

  instances.set(key, api);
  return api;
}
