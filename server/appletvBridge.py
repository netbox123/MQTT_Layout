#!/usr/bin/env python3
"""Apple TV MQTT bridge.

MQTT topics per device (replace {id} with the id from config/appletv.json):
  Subscribe:
    appletv/{id}/command   - remote command name (up/down/left/right/select/menu/
                             home/play_pause/play/pause/next/previous/volume_up/
                             volume_down/turn_on/turn_off/top_menu)
    appletv/{id}/volume/set - volume level 0-100 (float)
  Publish (retained):
    appletv/{id}/power     - "on" / "off"
    appletv/{id}/volume    - current volume 0-100
    appletv/{id}/playing   - JSON with title/artist/album/device_state/media_type/
                             position/total_time
"""

import asyncio
import json
import logging
import os
import re
import signal
import sys

import pyatv
import pyatv.const
import paho.mqtt.client as mqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_config():
    with open(os.path.join(BASE, "config", "appletv.json")) as f:
        atv_cfg = json.load(f)
    with open(os.path.join(BASE, "config", "mqtt.json")) as f:
        mqtt_cfg = json.load(f)
    m = re.match(r"mqtt://([^:]+):(\d+)", mqtt_cfg["broker_url"])
    return atv_cfg["devices"], {
        "host": m.group(1),
        "port": int(m.group(2)),
        "username": mqtt_cfg.get("username", ""),
        "password": mqtt_cfg.get("password", ""),
    }


class DeviceBridge(pyatv.interface.PushListener):
    def __init__(self, device_cfg, mq_client, loop):
        self.cfg = device_cfg
        self.mq = mq_client
        self.loop = loop
        self.atv = None
        self._reconnect_task = None
        self._id = device_cfg["id"]

    def _pub(self, subtopic, payload, retain=True):
        self.mq.publish(f"appletv/{self._id}/{subtopic}", payload, retain=retain)

    # ---- PushListener ----

    def playstatus_update(self, updater, playstatus):
        data = {
            "device_state": str(playstatus.device_state).split(".")[-1].lower(),
            "media_type": str(playstatus.media_type).split(".")[-1].lower(),
            "title": playstatus.title or "",
            "artist": playstatus.artist or "",
            "album": playstatus.album or "",
            "position": playstatus.position,
            "total_time": playstatus.total_time,
        }
        self._pub("playing", json.dumps(data))

    def playstatus_error(self, updater, exception):
        log.warning(f"[{self._id}] Push update error: {exception}")

    # ---- Connect / reconnect ----

    async def connect(self):
        while True:
            try:
                log.info(f"[{self._id}] Scanning for Apple TV at {self.cfg['address']}…")
                results = await pyatv.scan(
                    self.loop,
                    hosts=[self.cfg["address"]],
                    timeout=10,
                )
                if not results:
                    raise RuntimeError("Device not found")

                conf = results[0]
                conf.set_credentials(
                    pyatv.const.Protocol.Companion,
                    self.cfg["companion_credentials"],
                )

                self.atv = await pyatv.connect(conf, self.loop)
                log.info(f"[{self._id}] Connected")

                self.atv.push_updater.listener = self
                self.atv.push_updater.start()

                await self._publish_poll()
                return

            except Exception as e:
                log.error(f"[{self._id}] Connect failed: {e} — retry in 30 s")
                await asyncio.sleep(30)

    async def _publish_poll(self):
        try:
            power = self.atv.power.power_state
            self._pub("power", "on" if power == pyatv.const.PowerState.On else "off")
        except Exception as e:
            log.warning(f"[{self._id}] Power poll error: {e}")
        try:
            vol = self.atv.audio.volume
            self._pub("volume", str(round(vol)))
        except Exception as e:
            log.warning(f"[{self._id}] Volume poll error: {e}")

    async def run(self):
        await self.connect()
        while True:
            await asyncio.sleep(30)
            if self.atv:
                await self._publish_poll()

    # ---- Command handling ----

    async def handle_command(self, topic, payload):
        if self.atv is None:
            return
        try:
            if topic.endswith("/volume/set"):
                await self.atv.audio.set_volume(float(payload))
                return

            rc = self.atv.remote_control
            audio = self.atv.audio
            power = self.atv.power

            commands = {
                "up": rc.up, "down": rc.down, "left": rc.left, "right": rc.right,
                "select": rc.select, "menu": rc.menu, "home": rc.home,
                "play_pause": rc.play_pause, "play": rc.play, "pause": rc.pause,
                "next": rc.next, "previous": rc.previous,
                "skip_forward": rc.skip_forward, "skip_backward": rc.skip_backward,
                "volume_up": audio.volume_up, "volume_down": audio.volume_down,
                "turn_on": power.turn_on, "turn_off": power.turn_off,
                "top_menu": rc.top_menu,
            }

            if payload in commands:
                await commands[payload]()
                log.info(f"[{self._id}] → {payload}")
                await asyncio.sleep(0.1)
                await self._publish_poll()
            else:
                log.warning(f"[{self._id}] Unknown command: {payload!r}")

        except Exception as e:
            log.error(f"[{self._id}] Command error ({payload}): {e}")

    def close(self):
        if self.atv:
            self.atv.close()
            self.atv = None


class AppleTVBridge:
    def __init__(self, devices_cfg, mq):
        self.mq = mq
        self.loop = None  # set in run()
        self.device_cfgs = devices_cfg
        self.bridges = {}

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            log.info("MQTT connected")
            for dev_id in self.bridges:
                client.subscribe(f"appletv/{dev_id}/command")
                client.subscribe(f"appletv/{dev_id}/volume/set")
        else:
            log.error(f"MQTT connect refused: {reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        log.warning(f"MQTT disconnected: {reason_code}")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode().strip()
        for dev_id, bridge in self.bridges.items():
            if topic.startswith(f"appletv/{dev_id}/"):
                asyncio.run_coroutine_threadsafe(
                    bridge.handle_command(topic, payload), self.loop
                )

    async def run(self):
        self.loop = asyncio.get_event_loop()
        self.bridges = {d["id"]: DeviceBridge(d, self.mq, self.loop) for d in self.device_cfgs}
        self.mq.on_connect = self._on_connect
        self.mq.on_disconnect = self._on_disconnect
        self.mq.on_message = self._on_message
        # Re-subscribe in case MQTT already connected before bridges were created
        for dev_id in self.bridges:
            self.mq.subscribe(f"appletv/{dev_id}/command")
            self.mq.subscribe(f"appletv/{dev_id}/volume/set")
        tasks = [bridge.run() for bridge in self.bridges.values()]
        await asyncio.gather(*tasks)

    def cleanup(self):
        log.info("Shutting down…")
        for bridge in self.bridges.values():
            bridge.close()


def main():
    devices_cfg, mqtt_cfg = load_config()

    mq = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"appletv-bridge-{os.getpid()}",
        clean_session=True,
        reconnect_on_failure=False,
    )
    if mqtt_cfg["username"]:
        mq.username_pw_set(mqtt_cfg["username"], mqtt_cfg["password"])

    bridge = AppleTVBridge(devices_cfg, mq)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def _shutdown():
        log.info("Shutting down…")
        bridge.cleanup()
        mq.disconnect()
        mq.loop_stop()
        loop.stop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _shutdown)

    mq.connect(mqtt_cfg["host"], mqtt_cfg["port"])
    mq.loop_start()

    try:
        loop.run_until_complete(bridge.run())
    except Exception as e:
        log.error(f"Bridge error: {e}")
    finally:
        bridge.cleanup()
        mq.disconnect()
        mq.loop_stop()
        loop.close()


if __name__ == "__main__":
    main()
