"""
Kafka consumer for topic2 (KAFKA_SALLE_TOPIC).

Deux producteurs publient sur ce topic unique :

1. SalleReporter (10 Hz) — état upload du poste
   Discriminant : champ racine "source" == "pc"
   {
     "source": "pc", "pc_id": 3, "hostname": "PC-03",
     "timestamp": "...", "operator_username": "alice",
     "is_recording": true, "has_alert": false,
     "sqlite_queue": { "pending_sessions": 2, "total_records": 1847,
                       "oldest_pending_iso": "...", "sessions": [...] },
     "last_send": { "session_id": "...", "sent_at": "...",
                    "status": "success", "records_sent": 1203 }
   }
   Message de déconnexion : { "source": "pc", "pc_id": 3, "disconnected": true, "ts": ... }

2. KafkaEventPublisher (événementiel) — changements d'état cycle de vie
   Discriminant : champ racine "type" présent
   {
     "type": "<event_type>", "station_id": "PC-03", "ts": 1741234567.123,
     "operator": "alice", "scenario": "scenario-A", "payload": { ... }
   }
   Types d'événements : operator_connected, app_closed,
     cameras_detected, pince_connected, pince_disconnected,
     pince_switch_on, pince_switch_off, session_failed,
     tracker_connected, tracker_disconnected, tracker_lost,
     tracker_recovered, tracker_low_battery, tracker_critical_battery,
     recording_started, recording_stopped
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── In-memory state ───────────────────────────────────────────────────────────

# SalleReporter state (keyed by pc_id int)
_state = {
    "pcs": {},         # pc_id (int) -> PC state dict
    "last_update": None,
    "connected": False,
    "errors": [],
}

# KafkaEventPublisher state (keyed by station_id str, e.g. "PC-03")
# station_id -> {
#   "station_id", "operator", "scenario",
#   "cameras": [...], "pinces": {"left": {...}, "right": {...}},
#   "trackers": {idx -> {...}},
#   "recording": {"is_recording": bool, "duration_s": float, "trigger": str,
#                 "last_start_ts": float, "last_activity_ts": float},
#   "connected": bool,  # False après app_closed
#   "last_ts": float,
# }
_stations = {}

_pc_ever_seen: set = set()
_state_lock = threading.Lock()
_consumer_thread = None

PRESENCE_TIMEOUT_S = 30.0  # station marquée déconnectée si silencieuse > 30 s

# Champs visuels SalleReporter qui déclenchent une notification WS si changés
_PC_WATCHED_FIELDS = {
    "operator_username", "is_recording", "has_alert",
    "sqlite_queue", "last_send", "_disconnected", "hostname",
}


def _pc_visual_changed(prev: dict, next_msg: dict) -> bool:
    for field in _PC_WATCHED_FIELDS:
        if prev.get(field) != next_msg.get(field):
            return True
    return False


def _get_bootstrap_server():
    from config import KAFKA_BROKER, KAFKA_BROKER_PORT
    return f"{KAFKA_BROKER}:{KAFKA_BROKER_PORT}"


def _notify_ws():
    """Push state to all WebSocket clients."""
    try:
        from routes.salle import notify_ws
        notify_ws()
    except Exception:
        pass


# ── SalleReporter handler ─────────────────────────────────────────────────────

def _handle_salle_reporter(msg: dict, now: str):
    """Process a SalleReporter message (source == 'pc')."""
    pc_id = int(msg.get("pc_id", 0))
    if not (1 <= pc_id <= 30):
        return False

    _pc_ever_seen.add(pc_id)
    prev = _state["pcs"].get(pc_id, {})

    if msg.get("disconnected"):
        new_state = {
            "pc_id": pc_id,
            "hostname": msg.get("hostname") or prev.get("hostname") or f"PC-{pc_id:05d}",
            "operator_username": prev.get("operator_username"),
            "is_recording": False,
            "has_alert": False,
            "sqlite_queue": prev.get("sqlite_queue"),
            "last_send": prev.get("last_send"),
            "_disconnected": True,
            "last_seen_at": prev.get("last_seen_at"),
        }
    else:
        new_state = {
            "pc_id": pc_id,
            "hostname": msg.get("hostname") or prev.get("hostname") or f"PC-{pc_id:05d}",
            "operator_username": msg.get("operator_username") or None,
            "is_recording": bool(msg.get("is_recording")),
            "has_alert": bool(msg.get("has_alert")),
            "sqlite_queue": msg.get("sqlite_queue"),
            "last_send": msg.get("last_send"),
            "_disconnected": False,
            "last_seen_at": now,
        }

    if _pc_visual_changed(prev, new_state):
        _state["pcs"][pc_id] = new_state
        return True
    else:
        if not msg.get("disconnected"):
            prev["last_seen_at"] = now
        return False


# ── KafkaEventPublisher handler ───────────────────────────────────────────────

def _default_station(station_id: str) -> dict:
    return {
        "station_id": station_id,
        "operator": "",
        "scenario": "",
        "cameras": [],
        "pinces": {
            "left":  {"connected": False, "port": None},
            "right": {"connected": False, "port": None},
        },
        "trackers": {},   # idx (str) -> {idx, serial, tracking, battery}
        "recording": {
            "is_recording": False,
            "duration_s": 0.0,
            "trigger": None,
            "failed": False,
            "last_start_ts": 0.0,
            "last_activity_ts": 0.0,
        },
        "connected": True,
        "last_ts": 0.0,
    }


def _handle_event(msg: dict) -> bool:
    """Process a KafkaEventPublisher message (has 'type' field).
    Returns True if state changed (triggers WS push).
    """
    event_type = msg.get("type", "")
    station_id = str(msg.get("station_id", "")).strip()
    if not station_id:
        return False

    payload = msg.get("payload") or {}
    ts = float(msg.get("ts", time.time()))
    operator = str(msg.get("operator", ""))
    scenario = str(msg.get("scenario", ""))

    st = _stations.get(station_id) or _default_station(station_id)
    st["last_ts"] = ts
    if operator:
        st["operator"] = operator
    if scenario:
        st["scenario"] = scenario

    if event_type == "operator_connected":
        st["connected"] = True
        st["operator"] = payload.get("operator", operator)
        st["scenario"] = payload.get("scenario", scenario)

    elif event_type == "app_closed":
        st["connected"] = False
        st["recording"]["is_recording"] = False

    elif event_type == "cameras_detected":
        st["cameras"] = payload.get("cameras", [])

    elif event_type == "pince_connected":
        side = payload.get("side", "right")
        st["pinces"][side] = {"connected": True, "port": payload.get("port")}

    elif event_type == "pince_disconnected":
        side = payload.get("side", "right")
        st["pinces"][side] = {"connected": False, "port": None}

    elif event_type in ("pince_switch_on", "pince_switch_off"):
        # Informational only — no persistent state change needed
        pass

    elif event_type == "session_failed":
        st["recording"]["failed"] = True

    elif event_type == "tracker_connected":
        idx = str(payload.get("idx", ""))
        st["trackers"][idx] = {
            "idx": payload.get("idx"),
            "serial": payload.get("serial", ""),
            "tracking": True,
            "battery": st["trackers"].get(idx, {}).get("battery", 1.0),
        }

    elif event_type == "tracker_disconnected":
        idx = str(payload.get("idx", ""))
        st["trackers"].pop(idx, None)

    elif event_type == "tracker_lost":
        idx = str(payload.get("idx", ""))
        if idx in st["trackers"]:
            st["trackers"][idx]["tracking"] = False

    elif event_type == "tracker_recovered":
        idx = str(payload.get("idx", ""))
        if idx in st["trackers"]:
            st["trackers"][idx]["tracking"] = True

    elif event_type in ("tracker_low_battery", "tracker_critical_battery"):
        idx = str(payload.get("idx", ""))
        battery = float(payload.get("battery", 0.0))
        if idx in st["trackers"]:
            st["trackers"][idx]["battery"] = battery
        else:
            st["trackers"][idx] = {
                "idx": payload.get("idx"),
                "serial": "",
                "tracking": False,
                "battery": battery,
            }

    elif event_type == "recording_started":
        now = time.time()
        st["recording"]["is_recording"] = True
        st["recording"]["trigger"] = payload.get("trigger")
        st["recording"]["failed"] = False
        st["recording"]["last_start_ts"] = now
        st["recording"]["last_activity_ts"] = now
        st["operator"] = payload.get("operator", operator)
        st["scenario"] = payload.get("scenario", scenario)

    elif event_type == "recording_stopped":
        now = time.time()
        st["recording"]["is_recording"] = False
        st["recording"]["duration_s"] = float(payload.get("duration_s", 0.0))
        st["recording"]["failed"] = bool(payload.get("failed", False))
        st["recording"]["last_activity_ts"] = now

    else:
        logger.debug("KafkaEventPublisher: unknown event type '%s'", event_type)
        _stations[station_id] = st
        return False

    _stations[station_id] = st
    return True


# ── Message dispatcher ────────────────────────────────────────────────────────

def _process_message(raw_value: bytes):
    try:
        msg = json.loads(raw_value.decode("utf-8"))
    except Exception as e:
        logger.warning("Kafka topic2: invalid JSON — %s", e)
        return

    should_notify = False
    now = datetime.now(timezone.utc).isoformat()

    with _state_lock:
        _state["last_update"] = now

        if "source" in msg and msg["source"] == "pc":
            # SalleReporter — état upload poste
            should_notify = _handle_salle_reporter(msg, now)
        elif "type" in msg:
            # KafkaEventPublisher — événement cycle de vie
            should_notify = _handle_event(msg)
        else:
            logger.debug("Kafka topic2: message sans discriminant reconnu")

    if should_notify:
        _notify_ws()


# ── Consumer loop ─────────────────────────────────────────────────────────────

def _consumer_loop():
    bootstrap = _get_bootstrap_server()
    logger.info("Kafka consumer topic2: connecting to %s", bootstrap)

    while True:
        try:
            from kafka import KafkaConsumer
            consumer = KafkaConsumer(
                "topic2",
                bootstrap_servers=[bootstrap],
                auto_offset_reset="latest",
                enable_auto_commit=True,
                group_id="salle-recolte-monitor",
                value_deserializer=None,
                consumer_timeout_ms=5000,
            )
            with _state_lock:
                _state["connected"] = True
                _state["errors"] = []
            logger.info("Kafka consumer topic2: connected")

            for message in consumer:
                _process_message(message.value)

        except Exception as e:
            err_msg = str(e)
            logger.error("Kafka consumer topic2 error: %s", err_msg)
            with _state_lock:
                _state["connected"] = False
                _state["errors"].append({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "msg": err_msg,
                })
                _state["errors"] = _state["errors"][-10:]

            time.sleep(10)


def start_consumer():
    """Start the background Kafka consumer thread (idempotent)."""
    global _consumer_thread
    if _consumer_thread and _consumer_thread.is_alive():
        return
    _consumer_thread = threading.Thread(
        target=_consumer_loop,
        name="kafka-topic2-consumer",
        daemon=True,
    )
    _consumer_thread.start()
    logger.info("Kafka consumer thread started")


# ── Snapshots ─────────────────────────────────────────────────────────────────

def get_state_snapshot() -> dict:
    """Snapshot SalleReporter — état upload des 30 PCs."""
    with _state_lock:
        pcs = []
        for pc_id in range(1, 31):
            hostname = f"PC-{pc_id:05d}"
            data = _state["pcs"].get(pc_id)

            if data:
                pc = {
                    "pc_id":             data["pc_id"],
                    "hostname":          data.get("hostname") or hostname,
                    "operator_username": data.get("operator_username") or None,
                    "is_recording":      bool(data.get("is_recording")),
                    "has_alert":         bool(data.get("has_alert") or data.get("_disconnected")),
                    "sqlite_queue":      data.get("sqlite_queue"),
                    "last_send":         data.get("last_send"),
                    "last_seen_at":      data.get("last_seen_at"),
                    "_disconnected":     bool(data.get("_disconnected")),
                }
            elif pc_id in _pc_ever_seen:
                pc = {
                    "pc_id": pc_id, "hostname": hostname,
                    "operator_username": None, "is_recording": False,
                    "has_alert": False, "sqlite_queue": None, "last_send": None,
                    "last_seen_at": None, "_disconnected": True,
                }
            else:
                pc = {
                    "pc_id": pc_id, "hostname": hostname,
                    "operator_username": None, "is_recording": False,
                    "has_alert": False, "sqlite_queue": None, "last_send": None,
                    "last_seen_at": None, "_never_seen": True,
                }

            pcs.append(pc)

        return {
            "connected":   _state["connected"],
            "last_update": _state["last_update"],
            "errors":      list(_state["errors"]),
            "pcs":         pcs,
        }


def get_stations_snapshot() -> dict:
    """Snapshot KafkaEventPublisher — état cycle de vie des stations."""
    now = time.time()
    with _state_lock:
        stations = []
        for st in _stations.values():
            # Marquer comme déconnectée si silencieuse depuis trop longtemps
            connected = st["connected"]
            if connected and st["last_ts"] > 0:
                if (now - st["last_ts"]) > PRESENCE_TIMEOUT_S:
                    connected = False

            stations.append({
                "station_id": st["station_id"],
                "operator":   st["operator"],
                "scenario":   st["scenario"],
                "cameras":    list(st["cameras"]),
                "pinces":     dict(st["pinces"]),
                "trackers":   dict(st["trackers"]),
                "recording":  dict(st["recording"]),
                "connected":  connected,
                "last_ts":    st["last_ts"],
            })

        total = len(stations)
        connected_count = sum(1 for s in stations if s["connected"])
        recording_count = sum(1 for s in stations if s["connected"] and s["recording"]["is_recording"])

        return {
            "connected":   _state["connected"],
            "last_update": _state["last_update"],
            "errors":      list(_state["errors"]),
            "stats": {
                "total":      total,
                "connected":  connected_count,
                "recording":  recording_count,
                "disconnected": total - connected_count,
            },
            "stations": stations,
        }
