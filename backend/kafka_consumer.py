"""
Kafka consumer for topic2 — Salle de récolte de données.

Messages attendus (JSON) depuis les PCs :
  {
    "source": "pc",
    "pc_id": 1-30,
    "hostname": "pc-01",
    "timestamp": "2026-03-05T14:23:00Z",
    "sqlite_queue": {
      "pending_sessions": 3,
      "total_records": 1240,
      "oldest_pending_iso": "2026-03-05T08:00:00Z",
      "sessions": [
        { "session_id": "s001", "records": 412, "status": "pending" },
        ...
      ]
    },
    "last_send": {
      "session_id": "s000",
      "sent_at": "2026-03-05T14:20:00Z",
      "status": "success",       // "success" | "failed" | "in_progress"
      "records_sent": 412
    }
  }

Messages attendus (JSON) depuis le Spool :
  {
    "source": "spool",
    "timestamp": "2026-03-05T14:23:10Z",
    "inbound_queue": [
      { "pc_id": 3, "session_id": "s010", "received_at": "...", "size_mb": 12.4 }
    ],
    "processed_today": 58,
    "forwarded_to_nas": 55,
    "failed": 3,
    "current_transfer": {
      "from_pc": 7,
      "session_id": "s011",
      "progress_pct": 67,
      "speed_mbps": 45.2
    }
  }

Messages attendus (JSON) depuis le NAS :
  {
    "source": "nas",
    "timestamp": "2026-03-05T14:23:15Z",
    "total_sessions": 4200,
    "disk_used_gb": 1842,
    "disk_total_gb": 8000,
    "last_write": {
      "session_id": "s009",
      "written_at": "2026-03-05T14:21:00Z",
      "size_mb": 11.8
    },
    "status": "online"           // "online" | "degraded" | "offline"
  }
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── In-memory state (updated by the background consumer thread) ──────────────

_state = {
    "pcs": {},        # pc_id (int) -> stable PC state dict (never reset between messages)
    "spool": None,    # latest Spool message dict
    "nas": None,      # latest NAS message dict
    "last_update": None,
    "connected": False,
    "errors": [],
}
# pc_id (int) -> True si le PC a été vu au moins une fois depuis le démarrage
_pc_ever_seen: set = set()
_state_lock = threading.Lock()
_consumer_thread = None

# Champs qui déclenchent une notification WS si leur valeur change
_PC_WATCHED_FIELDS = {
    "operator_username", "is_recording", "has_alert",
    "sqlite_queue", "last_send", "_disconnected", "hostname",
}

def _pc_visual_changed(prev: dict, next_msg: dict) -> bool:
    """Return True only if a visually-relevant field changed."""
    for field in _PC_WATCHED_FIELDS:
        if prev.get(field) != next_msg.get(field):
            return True
    return False


def _get_bootstrap_server():
    from config import KAFKA_BROKER, KAFKA_BROKER_PORT
    return f"{KAFKA_BROKER}:{KAFKA_BROKER_PORT}"


def _notify_ws():
    """Push state to all WebSocket clients. Lazy import to avoid circular dependency."""
    try:
        from routes.salle import notify_ws
        notify_ws()
    except Exception:
        pass


def _process_message(raw_value: bytes):
    try:
        msg = json.loads(raw_value.decode("utf-8"))
    except Exception as e:
        logger.warning("Kafka topic2: invalid JSON — %s", e)
        return

    source = msg.get("source")
    should_notify = False
    now = datetime.now(timezone.utc).isoformat()

    with _state_lock:
        _state["last_update"] = now

        if source == "pc":
            pc_id = int(msg.get("pc_id", 0))
            if 1 <= pc_id <= 30:
                _pc_ever_seen.add(pc_id)
                prev = _state["pcs"].get(pc_id, {})

                if msg.get("disconnected"):
                    new_state = {
                        "pc_id": pc_id,
                        "hostname": msg.get("hostname") or prev.get("hostname") or f"PC-{pc_id:05d}",
                        # Preserve last known data for display in the detail panel
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
                        # last_seen_at is set server-side, not from message timestamp
                        "last_seen_at": now,
                    }

                if _pc_visual_changed(prev, new_state):
                    _state["pcs"][pc_id] = new_state
                    should_notify = True
                else:
                    # Update last_seen_at silently without triggering WS push
                    if not msg.get("disconnected"):
                        prev["last_seen_at"] = now

        elif source == "spool":
            # Compare ignoring timestamp field to avoid spurious WS pushes
            prev_spool = _state["spool"] or {}
            if any(
                prev_spool.get(k) != msg.get(k)
                for k in ("inbound_queue", "processed_today", "forwarded_to_nas", "failed", "current_transfer")
            ):
                _state["spool"] = msg
                should_notify = True
            else:
                # Update timestamp silently
                if _state["spool"]:
                    _state["spool"] = {**_state["spool"], "timestamp": msg.get("timestamp")}

        elif source == "nas":
            prev_nas = _state["nas"] or {}
            if any(
                prev_nas.get(k) != msg.get(k)
                for k in ("total_sessions", "disk_used_gb", "disk_total_gb", "last_write", "status")
            ):
                _state["nas"] = msg
                should_notify = True
            else:
                if _state["nas"]:
                    _state["nas"] = {**_state["nas"], "timestamp": msg.get("timestamp")}

        else:
            logger.debug("Kafka topic2: unknown source '%s'", source)

    if should_notify:
        _notify_ws()


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
                value_deserializer=None,   # raw bytes, we decode manually
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
                # Keep only last 10 errors
                _state["errors"] = _state["errors"][-10:]

            time.sleep(10)   # retry after 10 s


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


def get_state_snapshot() -> dict:
    """Return a JSON-serialisable snapshot of the current state.

    Timestamps from Kafka messages are intentionally excluded from the PC
    objects to avoid triggering spurious re-renders at 10 Hz. The server-side
    last_seen_at field is used instead (updated on every message but only
    pushed via WS when a visual field changes).
    """
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

        # Strip Kafka timestamps from spool/nas before sending — they change
        # every heartbeat and would cause constant re-renders on the front.
        spool = _state["spool"]
        if spool:
            spool = {k: v for k, v in spool.items() if k != "timestamp"}

        nas = _state["nas"]
        if nas:
            nas = {k: v for k, v in nas.items() if k != "timestamp"}

        return {
            "connected":   _state["connected"],
            "last_update": _state["last_update"],
            "errors":      list(_state["errors"]),
            "pcs":         pcs,
            "spool":       spool,
            "nas":         nas,
        }
