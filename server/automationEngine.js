// Server-side automations: MQTT value-change triggers, sun/state conditions,
// publish / wait_for / delay actions. Rules live in config/automations.json
// (hand-edited; the file is watched), run-time state (last run) in
// server/data/automations_state.json.
//
// Rule shape:
// {
//   "id": "shed_outdoor_on_arrive", "name": "...", "enabled": true,
//   "trigger":    { "type": "mqtt", "topic": "..." | ["...", "..."], "from": "not_home", "to": "home" },
//   "mode":       "single" (ignore triggers while running, default) | "restart" (cancel + start over),
//   "conditions": [ { "type": "sun", "state": "below_horizon" },
//                   { "type": "state", "topic": "...", "equals": "x" | ["x","y"], "not_equals": ... } ],
//   "actions":    [ { "type": "publish", "topic": "...", "payload": "ON", "retain": false },
//                   { "type": "wait_for", "topic": "...", "equals": "disarmed", "timeout_s": 120 },
//                   { "type": "delay", "seconds": 5 } ]
// }
// A trigger only fires on a real change between two known values, so the
// retained value delivered on (re)subscribe never fires a rule.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sunElevation, HORIZON } from './sun.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable for tests
const CONFIG_FILE = process.env.AUTOMATIONS_CONFIG || path.join(__dirname, '../config/automations.json');
const STATE_FILE = process.env.AUTOMATIONS_STATE || path.join(__dirname, 'data/automations_state.json');

const triggerTopics = (t) => (Array.isArray(t?.topic) ? t.topic : t?.topic ? [t.topic] : []);
const asList = (v) => (v === undefined ? null : Array.isArray(v) ? v.map(String) : [String(v)]);

export function createAutomationEngine({ mqttClient, wsServer }) {
  let config = { location: null, automations: [] };
  let runState = {};          // id -> { last_triggered, last_result, running }
  const values = new Map();   // topic -> last value
  const waiters = new Set();  // pending wait_for actions
  const activeRuns = new Map(); // automation id -> current run

  try { runState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch { runState = {}; }
  for (const s of Object.values(runState)) s.running = false;

  function saveState() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(runState, null, 2));
    } catch (err) { console.error('[Automations] Could not save state:', err.message); }
  }

  function load() {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      config.automations ??= [];
      console.log(`[Automations] Loaded ${config.automations.length} automation(s)`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[Automations] Could not load config/automations.json:', err.message);
      config = { location: null, automations: [] };
    }
    const topics = new Set();
    for (const a of config.automations) {
      for (const t of triggerTopics(a.trigger)) topics.add(t);
      for (const c of a.conditions ?? []) if (c.topic) topics.add(c.topic);
      for (const s of a.actions ?? []) if (s.type === 'wait_for' && s.topic) topics.add(s.topic);
    }
    if (topics.size) mqttClient.subscribeTopics([...topics]);
    broadcast();
  }

  function sunInfo() {
    const loc = config.location;
    if (loc?.lat == null || loc?.lon == null) return null;
    const elevation = sunElevation(loc.lat, loc.lon);
    return { elevation: Math.round(elevation * 10) / 10, below_horizon: elevation < HORIZON };
  }

  function list() {
    return {
      sun: sunInfo(),
      automations: config.automations.map(a => ({
        id: a.id,
        name: a.name ?? a.id,
        enabled: a.enabled !== false,
        last_triggered: runState[a.id]?.last_triggered ?? null,
        last_result: runState[a.id]?.last_result ?? null,
        running: runState[a.id]?.running ?? false,
        trigger: a.trigger,
        mode: a.mode ?? 'single',
        conditions: a.conditions ?? [],
        actions: a.actions ?? [],
      })),
    };
  }

  function broadcast() {
    wsServer.broadcast({ type: 'automations-state', ...list() });
  }

  function saveConfig() {
    // Write back the whole file; the watcher reload that follows is harmless.
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
    load();
  }

  function setEnabled(id, enabled) {
    const a = config.automations.find(x => x.id === id);
    if (!a) return false;
    a.enabled = !!enabled;
    console.log(`[Automations] ${a.name ?? id} ${a.enabled ? 'enabled' : 'disabled'}`);
    saveConfig();
    return true;
  }

  // Validate + normalise a rule coming from the editor. Returns { rule } or { error }.
  function sanitize(input) {
    const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
    const name = str(input?.name);
    if (!name) return { error: 'Name is required' };
    const t = input.trigger ?? {};
    const topicList = (Array.isArray(t.topic) ? t.topic : [t.topic]).map(str).filter(Boolean);
    if (!topicList.length) return { error: 'Trigger topic is required' };
    const trigger = { type: 'mqtt', topic: topicList.length === 1 ? topicList[0] : topicList };
    if (str(t.from)) trigger.from = str(t.from);
    if (str(t.to)) trigger.to = str(t.to);

    const conditions = [];
    for (const c of input.conditions ?? []) {
      if (c.type === 'sun') {
        if (!['below_horizon', 'above_horizon'].includes(c.state)) return { error: 'Invalid sun condition' };
        conditions.push({ type: 'sun', state: c.state });
      } else if (c.type === 'state') {
        if (!str(c.topic)) return { error: 'Condition topic is required' };
        const cond = { type: 'state', topic: str(c.topic) };
        if (c.not_equals !== undefined) cond.not_equals = str(c.not_equals);
        else cond.equals = str(c.equals);
        conditions.push(cond);
      } else return { error: `Unknown condition type ${c.type}` };
    }

    const actions = [];
    for (const s of input.actions ?? []) {
      if (s.type === 'publish') {
        if (!str(s.topic)) return { error: 'Publish topic is required' };
        const step = { type: 'publish', topic: str(s.topic), payload: str(s.payload) };
        if (s.retain === true) step.retain = true;
        actions.push(step);
      } else if (s.type === 'wait_for') {
        if (!str(s.topic) || !str(s.equals)) return { error: 'Wait for needs a topic and a value' };
        const timeout = Number(s.timeout_s);
        actions.push({ type: 'wait_for', topic: str(s.topic), equals: str(s.equals), timeout_s: timeout > 0 ? timeout : 60 });
      } else if (s.type === 'delay') {
        const seconds = Number(s.seconds);
        if (!(seconds >= 0)) return { error: 'Delay needs a number of seconds' };
        actions.push({ type: 'delay', seconds });
      } else return { error: `Unknown action type ${s.type}` };
    }
    if (!actions.length) return { error: 'Add at least one action' };

    const rule = { name, enabled: input.enabled !== false, trigger, conditions, actions };
    if (input.mode === 'restart') rule.mode = 'restart';
    return { rule };
  }

  function create(input) {
    const { rule, error } = sanitize(input);
    if (error) return { error };
    const base = rule.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'automation';
    let id = base, n = 2;
    while (config.automations.some(a => a.id === id)) id = `${base}_${n++}`;
    config.automations.push({ id, ...rule });
    console.log(`[Automations] Created ${rule.name}`);
    saveConfig();
    return { id };
  }

  function update(id, input) {
    const idx = config.automations.findIndex(a => a.id === id);
    if (idx < 0) return { error: 'not found', status: 404 };
    const { rule, error } = sanitize(input);
    if (error) return { error };
    config.automations[idx] = { id, ...rule };
    console.log(`[Automations] Updated ${rule.name}`);
    saveConfig();
    return { id };
  }

  function remove(id) {
    const idx = config.automations.findIndex(a => a.id === id);
    if (idx < 0) return false;
    const [a] = config.automations.splice(idx, 1);
    delete runState[id];
    saveState();
    console.log(`[Automations] Deleted ${a.name ?? id}`);
    saveConfig();
    return true;
  }

  // ── Conditions ──────────────────────────────────────────────────────────
  function checkCondition(c) {
    if (c.type === 'sun') {
      const sun = sunInfo();
      if (!sun) return { ok: false, why: 'no location configured for sun condition' };
      const want = c.state ?? 'below_horizon';
      const ok = want === 'below_horizon' ? sun.below_horizon : !sun.below_horizon;
      return { ok, why: `sun ${sun.elevation}° (${sun.below_horizon ? 'dark' : 'light'})` };
    }
    if (c.type === 'state') {
      const v = values.get(c.topic);
      const eq = asList(c.equals), neq = asList(c.not_equals);
      const ok = (!eq || eq.includes(v)) && (!neq || !neq.includes(v));
      return { ok, why: `${c.topic} = ${v ?? 'unknown'}` };
    }
    return { ok: false, why: `unknown condition type ${c.type}` };
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  // A run can be cancelled (mode "restart"); pending delays/waits end at once.
  function waitFor(run, topic, accepted, timeoutS) {
    if (accepted.includes(values.get(topic))) return Promise.resolve(true);
    return new Promise(resolve => {
      const w = {
        topic, accepted,
        done: (ok) => { clearTimeout(w.timer); waiters.delete(w); run.onCancel = null; resolve(ok); },
      };
      w.timer = setTimeout(() => w.done(false), (timeoutS ?? 60) * 1000);
      run.onCancel = () => w.done(false);
      waiters.add(w);
    });
  }

  function sleep(run, ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { run.onCancel = null; resolve(); }, ms);
      run.onCancel = () => { clearTimeout(timer); run.onCancel = null; resolve(); };
    });
  }

  async function runActions(a, run) {
    for (const step of a.actions ?? []) {
      if (run.cancelled) return 'restarted';
      if (step.type === 'publish') {
        mqttClient.publish(step.topic, step.payload ?? '', { retain: step.retain === true });
      } else if (step.type === 'delay') {
        await sleep(run, (step.seconds ?? 0) * 1000);
      } else if (step.type === 'wait_for') {
        const ok = await waitFor(run, step.topic, asList(step.equals) ?? [], step.timeout_s);
        if (run.cancelled) return 'restarted';
        if (!ok) return `stopped: ${step.topic} not ${asList(step.equals)?.join('/')} within ${step.timeout_s ?? 60}s`;
      } else {
        return `stopped: unknown action type ${step.type}`;
      }
    }
    return run.cancelled ? 'restarted' : 'done';
  }

  async function fire(a, reason) {
    const st = (runState[a.id] ??= {});
    if (st.running && a.mode !== 'restart') {
      console.log(`[Automations] ${a.name} still running, ignoring trigger`);
      return;
    }
    for (const c of a.conditions ?? []) {
      const { ok, why } = checkCondition(c);
      if (!ok) {
        console.log(`[Automations] ${a.name}: triggered (${reason}) but condition failed: ${why}`);
        st.last_condition_skip = new Date().toISOString();
        return;
      }
    }
    const previous = activeRuns.get(a.id);
    if (previous) {
      previous.cancelled = true;
      previous.onCancel?.();
    }
    const run = { cancelled: false, onCancel: null };
    activeRuns.set(a.id, run);
    console.log(`[Automations] ${a.name}: ${previous ? 'restarting' : 'running'} (${reason})`);
    st.running = true;
    st.last_triggered = new Date().toISOString();
    st.last_result = 'running';
    broadcast();
    let result;
    try { result = await runActions(a, run); }
    catch (err) { result = `error: ${err.message}`; }
    if (activeRuns.get(a.id) !== run) return; // superseded by a restart
    activeRuns.delete(a.id);
    st.running = false;
    st.last_result = result;
    console.log(`[Automations] ${a.name}: ${result}`);
    saveState();
    broadcast();
  }

  // Called for every incoming MQTT message.
  function onMessage(topic, value) {
    const prev = values.get(topic);
    values.set(topic, value);

    for (const w of [...waiters]) {
      if (w.topic === topic && w.accepted.includes(value)) w.done(true);
    }

    if (prev === undefined || prev === value) return;
    for (const a of config.automations) {
      const t = a.trigger;
      if (a.enabled === false || t?.type !== 'mqtt' || !triggerTopics(t).includes(topic)) continue;
      const from = asList(t.from), to = asList(t.to);
      if (from && !from.includes(prev)) continue;
      if (to && !to.includes(value)) continue;
      fire(a, `${topic}: ${prev} → ${value}`);
    }
  }

  // Reload when the file is edited by hand.
  let debounce = null;
  fs.watch(path.dirname(CONFIG_FILE), (_e, filename) => {
    if (filename !== path.basename(CONFIG_FILE)) return;
    clearTimeout(debounce);
    debounce = setTimeout(load, 300);
  });

  // Keep the card's dark/light line fresh.
  setInterval(broadcast, 60000);

  load();
  return { onMessage, list, setEnabled, create, update, remove };
}
