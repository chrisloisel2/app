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
from collections import defaultdict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── In-memory state (updated by the background consumer thread) ──────────────

_state = {
    "pcs": {},        # pc_id (int) -> latest PC message dict
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


def _get_bootstrap_server():
    from config import KAFKA_BROKER, KAFKA_BROKER_PORT
    return f"{KAFKA_BROKER}:{KAFKA_BROKER_PORT}"


def _process_message(raw_value: bytes):
    try:
        msg = json.loads(raw_value.decode("utf-8"))
    except Exception as e:
        logger.warning("Kafka topic2: invalid JSON — %s", e)
        return

    source = msg.get("source")
    with _state_lock:
        _state["last_update"] = datetime.now(timezone.utc).isoformat()
        if source == "pc":
            pc_id = int(msg.get("pc_id", 0))
            if 1 <= pc_id <= 30:
                _pc_ever_seen.add(pc_id)
                if msg.get("disconnected"):
                    # Message explicite de déconnexion : on marque _disconnected
                    # mais on conserve le hostname et les dernières infos connues
                    prev = _state["pcs"].get(pc_id, {})
                    _state["pcs"][pc_id] = {
                        **prev,
                        "pc_id": pc_id,
                        "hostname": msg.get("hostname", prev.get("hostname", f"PC-{pc_id:05d}")),
                        "timestamp": msg.get("timestamp"),
                        "_disconnected": True,
                    }
                else:
                    _state["pcs"][pc_id] = {**msg, "_disconnected": False}
        elif source == "spool":
            _state["spool"] = msg
        elif source == "nas":
            _state["nas"] = msg
        else:
            logger.debug("Kafka topic2: unknown source '%s'", source)


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
    """Return a JSON-serialisable snapshot of the current state."""
    with _state_lock:
        # Build PC list for all 30 slots
        pcs = []
        for pc_id in range(1, 31):
            data = _state["pcs"].get(pc_id)
            if data:
                # PC déjà vu : on transmet tel quel (_disconnected peut être True/False)
                pcs.append(data)
            elif pc_id in _pc_ever_seen:
                # Ne devrait pas arriver (on stocke toujours dans _state["pcs"] dès la 1ère vue)
                # mais par sécurité : PC vu mais données absentes = déconnecté
                pcs.append({
                    "source": "pc",
                    "pc_id": pc_id,
                    "hostname": f"PC-{pc_id:05d}",
                    "timestamp": None,
                    "sqlite_queue": None,
                    "last_send": None,
                    "_disconnected": True,
                })
            else:
                # Jamais vu depuis le démarrage du backend
                pcs.append({
                    "source": "pc",
                    "pc_id": pc_id,
                    "hostname": f"PC-{pc_id:05d}",
                    "timestamp": None,
                    "sqlite_queue": None,
                    "last_send": None,
                    "_never_seen": True,
                })
        return {
            "connected": _state["connected"],
            "last_update": _state["last_update"],
            "errors": list(_state["errors"]),
            "pcs": pcs,
            "spool": _state["spool"],
            "nas": _state["nas"],
        }
