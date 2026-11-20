# MQTT Dashboard

A local-first, MQTT-driven home automation dashboard built with **Vue 3 + Express**. Designed to run fully off-grid with zero cloud dependencies.

![Dashboard](pict.jpg)

## Features

- **Real-time MQTT data** — sensors, switches, gauges, indicators all driven by MQTT topics
- **Weather card** — 7-day forecast via Open-Meteo (no API key needed)
- **Camera cards** — live MJPEG streams with proxy support
- **Music Assistant** — full player control with queue, browse, radio tabs and audio announcements; album art via Last.fm lookup for radio streams
- **Notification system** — persistent log, overlay with sounds, edge-triggered MQTT events
  - Plays sounds locally and via Music Assistant on all active players
  - Edge detection: fires only when a value *crosses* a threshold (not on every message)
  - String equality trigger (`= ON`) for binary sensors (e.g. motion detection)
- **Victron integration** — solar, battery, inverter data via MQTT; Victron GX GUI v2 proxied and made available outside the local network via Caddy
- **ESP32 direct MQTT** — switches, lights and sensors on ESPHome boards publish/subscribe straight to the broker, no Home Assistant round-trip — see [ESP32 Direct MQTT](#esp32-direct-mqtt) below
- **URL launcher** — categorised links with tab navigation
- **Recipe viewer** — stored locally, no external services
- **Mobile layout** — dedicated responsive view at `/m/<page-slug>` with per-card mobile visibility and ordering
- **Edit mode** — all cards support drag-and-drop repositioning and grid resizing directly in the browser; add, remove and configure cards without touching config files
- **Philips TV remote** — dedicated full-screen remote page at `/remote`, optimised for iPhone (no sidebar, large touch targets)
- **IR remote system** — register ESP32 IR transceivers as transmitters, then register TV / soundbar devices against them; learn codes directly from physical remotes via MQTT; open styled remotes as an overlay on desktop or full-screen on mobile
- **WLED integration** — register WLED dimmers via the `/wled` device page; control them with the WLED card, each with its own RGBW color
- **Theme system** — create, edit and apply custom UI themes; live preview while editing colors and fonts; themes persist across sessions
- **IPTV / TV channels** — browse, search and favorite ~10,000 live TV channels from the [iptv-org](https://github.com/iptv-org/iptv) public dataset; plays directly in-browser (no VLC needed) via a backend HLS relay proxy
- **Caddy reverse proxy** — HTTPS with basic auth, WebSocket support

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vue 3, Vite, Pinia, Vue Router |
| Backend | Node.js, Express |
| Realtime | MQTT (via mqtt.js), WebSocket |
| Proxy | Caddy |

## Getting Started

### 1. Clone

```bash
git clone https://github.com/yourusername/mqtt-dashboard.git
cd mqtt-dashboard
```

### 2. Configure

```bash
cp config/mqtt.example.json config/mqtt.json
```

Edit it with your broker credentials. Then create your first page by copying the example:

```bash
cp config/pages/example-page.json config/pages/living-room.json
```

### 3. Install & Run

```bash
# Server
cd server && npm install
node index.js

# Frontend (dev)
cd frontend && npm install
npm run dev

# Frontend (production build)
npm run build
# Serve dist/ via Caddy or any static server
```

### 4. Sounds (optional)

Place `.mp3` files in:
- `sounds/alert_sounds/` — alert tones
- `sounds/speech_sounds/` — speech/TTS files

These are served at `/sounds/` and used by the notification system.

## Card Types

| Type | Description |
|---|---|
| `sensor` | Numeric MQTT value with unit |
| `gauge` | Arc gauge with min/max/color thresholds |
| `switch` | Toggle via MQTT — publishes to `command_topic` (JSON for lights, plain text for switches) |
| `indicator` | On/off state indicator |
| `button` | Publish a fixed MQTT payload |
| `text` | Display any MQTT string value |
| `weather` | Current conditions + 7-day forecast |
| `camera` | MJPEG stream with snapshot |
| `entities` | List of HA entities with state |
| `grid` | Mini sensor/switch grid |
| `musicassistant` | Music Assistant player card with album art |
| `notification` | Persistent notification log |
| `url` | Categorised link launcher |
| `webpage` | Embedded iframe |
| `recipe` | Local recipe viewer |
| `machine` | Network machines — online status, Wake on LAN, shutdown |
| `tv` | Network TVs — online status, Wake on LAN, power off |
| `wled` | WLED LED strip control — per-device lightbulb toggle with its own RGBW color |
| `wiim` | WiiM / LinkPlay streamer — volume slider and input selector with custom labels |
| `scenes` | Lighting scene sequencer — play ordered sequences of dimmer, fade, random and light steps (publishes MQTT directly to ESP32-backed lights, falling back to HA only for non-MQTT entities) |
| `theme` | UI theme manager — create and apply custom color and font themes with live preview |
| `irtransmitter` | ESP32 IR transmitter registry — add, edit and delete transmitters (id, name, IP) |
| `irreceiver` | IR device registry — register TVs and soundbars, assign a transmitter, learn commands from a physical remote, open a styled remote control |

## Site Dashboard Integration

The `machine` and `tv` card types consume retained MQTT messages published by [Site Dashboard](https://github.com/netbox123/SIte_Dashboard).

Configure the card with the matching `mqtt_prefix`:

| Card type | `mqtt_prefix` |
|---|---|
| `machine` | `site_dashboard/machines` |
| `tv` | `site_dashboard/tvs` |

The card auto-discovers all devices by scanning received topics matching `{prefix}/+/state`. Wake and Off button clicks publish to `{prefix}/{id}/command`.

## Notification Events

Notification events trigger automatically based on MQTT topic values:

- `>` / `<` — numeric threshold crossing (edge-triggered)
- `=` — string equality transition (e.g. `ON` for motion sensors)

Each event links to a notification rule that defines the title, message, and sounds to play.

## Configuration Files

| File | Description |
|---|---|
| `config/mqtt.json` | MQTT broker connection settings |
| `config/pages/*.json` | Page and card layouts |
| `config/urls.json` | URL launcher categories and links |
| `config/wled_devices.json` | Registered WLED dimmers (id, name, IP) |
| `config/themes.json` | UI themes (auto-generated via Theme card) |
| `config/notifications.json` | Notification history log (auto-generated) |
| `config/notification_events.json` | MQTT trigger rules (auto-generated) |
| `config/scenes.json` | Lighting scenes (auto-generated via UI) |
| `config/ir_devices.json` | Registered ESP32 IR transmitters (auto-generated via UI) |
| `config/ir_receivers.json` | IR device configs — commands per device keyed by `config_key` (auto-generated via UI) |
| `config/remotes.json` | Remote type definitions (type, name, brand) |
| `config/remotes/*.json` | Per-type key definitions for remote layouts |
| `config/iptv_favorites.json` | Favorited IPTV channel IDs (auto-generated via UI) |

## WLED Integration

WLED dimmers are registered in `config/wled_devices.json`:

```json
[
  { "id": "c18cbc", "name": "Living Room Strip", "ip": "192.168.0.61" }
]
```

The `id` is the last part of the WLED MQTT topic (e.g. `wled/c18cbc/`). The server subscribes to `wled/#` automatically and forwards all messages to the frontend via WebSocket.

**Workflow:**
1. Go to the **WLED** page in the sidebar to register your dimmers
2. Add a **WLED card** to any dashboard page, select devices and set an RGBW color for each
3. Click the lightbulb icon on the card to toggle the strip on/off using the configured color

Color changes publish a JSON payload to `wled/{id}/api`:
```json
{ "on": true, "bri": 255, "seg": [{ "col": [[R, G, B, W]] }] }
```

## Scenes

The **Scenes card** lets you build and play multi-step lighting sequences across WLED dimmers and MQTT-controlled lights/switches.

### Scene items

| Item type | Description |
|---|---|
| **Set dimmer** | Instantly sets all scene WLED devices to an RGBW color (`transition: 0`) |
| **Fade** | Smoothly fades from the current color to a target RGBW color; calculated in 1-second steps with `transition: 9` (no WLED 65 s limit) |
| **Random** | Continuously fades between randomly generated RGBW colors. Choose which channels (R/G/B/W) randomize, set a base color, a **speed** (seconds between targets) and a **random** deviation (±1–255). Interpolated in 1-second steps for smooth transitions |
| **Set light** | Turns one or more MQTT-controlled lights/switches ON or OFF — publishes directly to each entity's `command_topic` |

### Scene queue

Up to two scenes can be active simultaneously — one playing (green dot + live progress bar) and one paused (red dot + frozen progress bar at the paused position).

When a second scene is triggered:
- The playing scene is **paused** — its elapsed position and WLED colors are saved
- The new scene starts from the beginning
- When the new scene finishes, the paused scene **resumes from where it stopped**: skipped items are skipped, in-progress items continue, and the WLED dimmers are snapped back to their saved colors before resuming

Triggering a third scene while both slots are full is silently denied — the queue stays unchanged.

### Triggers

Each scene can be set to fire automatically:

- **MQTT** — fires on an edge-detected MQTT topic value (same `>` / `<` / `=` logic as notification events)
- **Time** — fires at a specific time (24 h), with per-day-of-week checkboxes (MTWTFSS); scheduled server-side, aligned to the clock minute

### Workflow

1. Add a **Scenes card** to a dashboard page
2. Click **+** to create a scene — give it a name, select WLED devices, and optionally configure a trigger
3. Click the scene name to open the scene editor and add items (Set dimmer / Fade / Set light)
4. Click the play button on any scene row to run it immediately

## WiiM Integration

The `wiim` card controls any WiiM or LinkPlay-based streamer over its local HTTPS API. Configure the card with the device IP address.

| Card field | Description |
|---|---|
| `title` | Display name |
| `ip` | Device IP address (e.g. `192.168.0.22`) |

The card polls the device every 3 seconds for live volume and input state. Volume changes are debounced and sent immediately on release. Supported inputs: WiFi, Bluetooth, Line In, Optical. Input button labels can be customised per card via the edit dialog.

The server proxies all requests to `https://{ip}/httpapi.asp` (bypassing the self-signed certificate) to avoid CORS issues in the browser.

## Theme System

The **Theme card** lets you create and manage custom UI themes. Each theme defines the full set of CSS variables used by the dashboard — background colors, text colors, accent colors, font family and font size.

- **Live preview** — changes apply instantly to the dashboard as you edit
- **Revert on cancel** — closing the dialog without saving restores the previous appearance
- **Persist on apply** — applied theme is saved to `localStorage` and restored on next load with no flash
- **Fonts bundled** — Inter, Roboto, Open Sans, Lato, Nunito and Ubuntu are served directly from the app with no CDN dependency

## ESP32 Direct MQTT

Switches, lights and sensors on ESPHome boards used to reach the dashboard exclusively via Home Assistant's `mqtt_statestream` integration (republishing under `homeassistant/{component}/{id}/state`) and were controlled via the HA REST API. Boards are being migrated one at a time to publish and subscribe **directly** to the broker instead, cutting HA out of the data path entirely.

### ESPHome config

Add a native `mqtt:` block alongside the existing `api:` block — don't remove `api:`, so Home Assistant's own integration and statestream keep working unchanged during (and after) the migration:

```yaml
mqtt:
  broker: 192.168.0.20
  port: 1883
  username: !secret mqtt_username
  password: !secret mqtt_password
  topic_prefix: esp32
  discovery: false
```

- `topic_prefix: esp32` — a literal, shared prefix (not the device name), giving topics like `esp32/sensor/{id}/state`
- `discovery: false` — prevents ESPHome's own MQTT discovery from creating duplicate entities in HA (the device is already exposed there via `api:`)
- ESPHome auto-derives each topic's `{id}` segment from the entity's `name:`, lowercased with spaces/`#` collapsed to `_` (hyphens are left untouched) — since there's no per-device path segment, entities on boards whose names don't already include the device (e.g. `"#1 outdoor"`) should be renamed to `<device>_<pin#>_<description>` (e.g. `shed8a_1_outdoor`) before flashing, to avoid collisions with other boards sharing the same flat `esp32/` prefix

### Topic convention

| Component | State topic | Command topic | Payload |
|---|---|---|---|
| `sensor` / `binary_sensor` | `esp32/{component}/{id}/state` | — | plain text |
| `switch` | `esp32/switch/{id}/state` | `esp32/switch/{id}/command` | plain text (`ON` / `OFF`) |
| `light` | `esp32/light/{id}/state` | `esp32/light/{id}/command` | JSON (`{"state":"ON"}`; state topic returns `{"color_mode":"onoff","state":"ON","color":{}}`) |

### Dashboard side

Card config uses two separate fields: `mqtt_topic` for what to display (state), `command_topic` for where to publish when toggled. Toggle logic (`GridCard.vue`, `SwitchCard.vue`, and the Scenes card's light-trigger) publishes MQTT directly to `command_topic`, branching on JSON vs. plain payload by whether the topic is under `/light/`. There's no Home Assistant fallback — every togglable entity needs a real MQTT command topic.

> **Deploy note:** the backend loads `config/pages/*.json` into memory once at startup and builds its MQTT subscription list from that snapshot — editing the JSON on disk needs a server restart to take effect. The frontend is served from the built `frontend/dist/` bundle, not source — editing `.vue` files needs `npm run build` before changes show up in the browser.

## IR Remote System

Control TVs and soundbars via ESP32 IR transceivers — no cloud, no app, just MQTT.

### Hardware

Any ESP32 with an IR LED and TSOP-type IR receiver, flashed with ESPHome. A ready-to-use ESPHome template is in [`esphome/ir-board-esp32.yaml`](esphome/ir-board-esp32.yaml) — copy it, replace the `XX` placeholders with your board number and IP, and flash via OTA.

MQTT topics used by each board:

| Topic | Direction | Payload |
|---|---|---|
| `ir/{id}/transmit` | Dashboard → ESP32 | Raw IR timing array, e.g. `[2697,-865,476,...]` |
| `ir/{id}/learned` | ESP32 → Dashboard | Raw IR timing array of any received signal |

The board continuously publishes to `ir/{id}/learned` for every IR signal it receives. The dashboard captures it during the 33-second learn window when a Learn button is active.

> **Pins (AliExpress IR board):** IR TX → GPIO4, IR RX → GPIO14 (inverted, pull-up)

> **MQTT credentials:** add `mqtt_username` and `mqtt_password` to your ESPHome `secrets.yaml`, matching `config/mqtt.json`.

### Setup

**Step 1 — Register transmitters**

Add an `irtransmitter` card to any dashboard page. Click **+** to register each ESP32 module with a name and ID. The ID must match the hostname used in the ESPHome YAML (e.g. `ir-47`).

**Step 2 — Register IR devices**

Add an `irreceiver` card (give it a unique `config_key` in the card settings). Click **+** to register a device (TV or soundbar):

- **Name** — display name (e.g. "Living Room TV")
- **Type** — `philips_tv`, `lg_tv`, or `soundbar`
- **Transmitter** — select which ESP32 will send IR to this device
- **Commands** — one row per button; enter a code manually or click **Learn** to capture it from the original remote

**Learn flow:**
1. Click **Learn** next to a command button — the button pulses for 33 seconds
2. Point the original remote at the ESP32 and press the button
3. The captured code auto-fills and the pulse stops

### Using the remote

Click **Remote** on any registered device to open the remote control:

- **Desktop** — opens as a centered overlay with a dark styled shell
- **Mobile** — opens full-screen (tap **← Back** to return)

The **Remotes** page (accessible from the sidebar) provides a tab-based interface: top tabs switch between remote types (Philips TV, LG TV, Soundbar), and receiver tabs inside the remote shell switch between devices assigned to each transmitter.

### Supported remote layouts

| Type | Buttons |
|---|---|
| `philips_tv` | Power, play controls, source, D-pad + OK, back/options, vol/home, color buttons |
| `lg_tv` | Power, source/mute/settings, D-pad + OK, back/home/info, vol/ch, play controls |
| `soundbar` | Power, volume up/down, mute |

## IPTV / TV Channels

The **TV** page (sidebar / mobile nav) turns the sprawling [iptv-org](https://github.com/iptv-org/iptv) public channel list into something actually usable — no more scrolling a 13,000-entry playlist in VLC with no favorites.

- **Data** — the server fetches and joins `channels`, `streams`, `countries`, `categories` and `logos` from the [iptv-org API](https://iptv-org.github.io/api/) at startup and every 24h, keeping ~10,000 channels (with at least one stream, excluding NSFW) cached in memory.
- **Browsing** — search by name, filter by country or category, toggle between All and Favorites.
- **Favorites** — starred channels are saved server-side in `config/iptv_favorites.json`, so they sync across every device on the dashboard rather than living in one browser's `localStorage`.
- **Playback** — almost all channels are HLS (`.m3u8`), which don't play natively in most browsers and often hit CORS, mixed-content (`http://` on an https dashboard), or custom `Referer`/`User-Agent` requirements. The server proxies streams at `/api/iptv/stream`, rewriting playlist URLs (master → media → segments) so [hls.js](https://github.com/video-dev/hls.js) can play them directly in the browser — VLC is no longer required. Safari uses its native HLS support instead of hls.js.
- **Reliability** — if a channel's stream fails, the player automatically tries that channel's next mirror (some channels list multiple); if all fail, it shows "unavailable" rather than hanging.

## License

MIT
