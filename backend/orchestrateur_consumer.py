"""
Kafka consumer for topic1 — Orchestrateur Monitor.

Messages expected (JSON):
{
  "id": "ind_001",
  "operator": "Alice",
  "scenario": "scénario_A",
  "ts": 1234567890.0,
  "tracker_right":  { "state": "OK|WARN|ERROR|DISCONNECTED", "value": 1.23 },
  "tracker_left":   { "state": "OK", "value": 0.95 },
  "tracker_head":   { "state": "OK", "value": 1.10 },
  "pince_droite":   { "connected": true },
  "pince_gauche":   { "connected": false },
  "camera1":        { "connected": true },
  "camera2":        { "connected": true },
  "camera3":        { "connected": false },
  "recording": {
    "is_recording": true,
    "duration_s": 42.5
  }
}
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

ALERT_TIMEOUT_S = 120.0

_state = {
    "individuals": {},   # id -> dict
    "connected": False,
    "last_update": None,
    "errors": [],
}
_state_lock = threading.Lock()
_consumer_thread = None


def _get_bootstrap_server():
    from config import KAFKA_BROKER, KAFKA_BROKER_PORT
    return f"{KAFKA_BROKER}:{KAFKA_BROKER_PORT}"


def _get_topic():
    from config import KAFKA_TOPIC
    return KAFKA_TOPIC


def _process_message(raw_value: bytes):
    try:
        ev = json.loads(raw_value.decode("utf-8"))
    except Exception as e:
        logger.warning("Kafka topic1: invalid JSON — %s", e)
        return

    uid = str(ev.get("id", "")).strip()
    if not uid:
        return

    now = time.time()

    with _state_lock:
        _state["last_update"] = datetime.now(timezone.utc).isoformat()

        ind = _state["individuals"].get(uid, {
            "id": uid,
            "operator": "",
            "scenario": "",
            "tracker_right":  {"state": "DISCONNECTED", "value": 0.0},
            "tracker_left":   {"state": "DISCONNECTED", "value": 0.0},
            "tracker_head":   {"state": "DISCONNECTED", "value": 0.0},
            "pince_droite":   {"connected": False},
            "pince_gauche":   {"connected": False},
            "camera1":        {"connected": False},
            "camera2":        {"connected": False},
            "camera3":        {"connected": False},
            "recording": {
                "is_recording": False,
                "duration_s": 0.0,
                "last_start_ts": 0.0,
                "last_activity_ts": 0.0,
            },
            "last_ts": 0.0,
            "connected": True,
        })

        ind["id"]       = uid
        ind["operator"] = str(ev.get("operator", ind["operator"]))
        ind["scenario"] = str(ev.get("scenario", ind["scenario"]))

        for key in ("tracker_right", "tracker_left", "tracker_head"):
            raw = ev.get(key) or {}
            ind[key]["state"] = str(raw.get("state", ind[key]["state"]))
            ind[key]["value"] = float(raw.get("value", ind[key]["value"]))

        for key in ("pince_droite", "pince_gauche", "camera1", "camera2", "camera3"):
            raw = ev.get(key) or {}
            ind[key]["connected"] = bool(raw.get("connected", ind[key]["connected"]))

        rec_raw = ev.get("recording") or {}
        was_recording = ind["recording"]["is_recording"]
        ind["recording"]["is_recording"] = bool(rec_raw.get("is_recording", ind["recording"]["is_recording"]))
        ind["recording"]["duration_s"]   = float(rec_raw.get("duration_s",   ind["recording"]["duration_s"]))
        if ind["recording"]["is_recording"] and not was_recording:
            ind["recording"]["last_start_ts"] = now
        if ind["recording"]["is_recording"]:
            ind["recording"]["last_activity_ts"] = now

        ind["last_ts"]   = float(ev.get("ts", now))
        ind["connected"] = True

        _state["individuals"][uid] = ind


def _consumer_loop():
    bootstrap = _get_bootstrap_server()
    topic = _get_topic()
    logger.info("Kafka consumer topic1 (orchestrateur): connecting to %s, topic=%s", bootstrap, topic)

    while True:
        try:
            from kafka import KafkaConsumer
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=[bootstrap],
                auto_offset_reset="latest",
                enable_auto_commit=True,
                group_id="orchestrateur-monitor",
                value_deserializer=None,
                consumer_timeout_ms=5000,
            )
            with _state_lock:
                _state["connected"] = True
                _state["errors"] = []
            logger.info("Kafka consumer topic1 (orchestrateur): connected")

            for message in consumer:
                _process_message(message.value)

        except Exception as e:
            err_msg = str(e)
            logger.error("Kafka consumer topic1 error: %s", err_msg)
            with _state_lock:
                _state["connected"] = False
                _state["errors"].append({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "msg": err_msg,
                })
                _state["errors"] = _state["errors"][-10:]

            time.sleep(10)


def start_orchestrateur_consumer():
    """Start the background Kafka consumer thread for topic1 (idempotent)."""
    global _consumer_thread
    if _consumer_thread and _consumer_thread.is_alive():
        return
    _consumer_thread = threading.Thread(
        target=_consumer_loop,
        name="kafka-topic1-orchestrateur",
        daemon=True,
    )
    _consumer_thread.start()
    logger.info("Orchestrateur Kafka consumer thread started")


def get_orchestrateur_snapshot() -> dict:
    """Return a JSON-serialisable snapshot of the current orchestrateur state."""
    now = time.time()
    with _state_lock:
        individuals = list(_state["individuals"].values())

        # Compute stats
        total = len(individuals)
        ok = warn = error = rec = disconnected = 0

        for ind in individuals:
            if not ind.get("connected"):
                disconnected += 1
                continue

            trackers = [ind["tracker_right"], ind["tracker_left"], ind["tracker_head"]]
            has_error = any(t["state"] == "ERROR" for t in trackers)
            has_warn  = any(t["state"] in ("WARN", "DISCONNECTED") for t in trackers)

            r = ind["recording"]
            if r["is_recording"]:
                if r["last_start_ts"] > 0 and (now - r["last_start_ts"]) > ALERT_TIMEOUT_S:
                    rec_col = "orange"
                else:
                    rec_col = "green"
            elif r["last_activity_ts"] > 0 and (now - r["last_activity_ts"]) > ALERT_TIMEOUT_S:
                rec_col = "orange"
            else:
                rec_col = "grey"

            if has_error or rec_col == "red":
                error += 1
            elif has_warn or rec_col == "orange":
                warn += 1
            elif all(t["state"] == "OK" for t in trackers):
                ok += 1

            if r["is_recording"]:
                rec += 1

        return {
            "connected": _state["connected"],
            "last_update": _state["last_update"],
            "errors": list(_state["errors"]),
            "stats": {
                "total": total,
                "ok": ok,
                "warn": warn,
                "error": error,
                "recording": rec,
                "disconnected": disconnected,
            },
            "individuals": individuals,
        }
