"""
WebSocket route that streams raw Kafka messages from all topics in real time.
Each connected client receives every message as a JSON line:
  { "topic": "monitoring", "ts": 1741437600.123, "raw": { ... } }
"""

import json
import threading
import time
import logging

from flask import Blueprint

logger = logging.getLogger(__name__)

kafka_logs_bp = Blueprint("kafka_logs", __name__)

# ── Client registry ───────────────────────────────────────────────────────────
_clients: set = set()
_clients_lock = threading.Lock()
_last_kafka_status: dict = {"kafka_connected": False, "error": None}


def broadcast(topic: str, raw: dict):
    """Called by any Kafka consumer when a message arrives."""
    line = json.dumps({"topic": topic, "ts": time.time(), "raw": raw})
    with _clients_lock:
        dead = set()
        for ws in _clients:
            try:
                ws.send(line)
            except Exception:
                dead.add(ws)
        _clients.difference_update(dead)


def broadcast_status(connected: bool, error: str = None):
    """Called by Kafka consumer to report its connection status."""
    global _last_kafka_status
    _last_kafka_status = {"kafka_connected": connected, "error": error}
    line = json.dumps({
        "topic": "__status__",
        "ts": time.time(),
        "raw": _last_kafka_status,
    })
    with _clients_lock:
        dead = set()
        for ws in _clients:
            try:
                ws.send(line)
            except Exception:
                dead.add(ws)
        _clients.difference_update(dead)


def register_ws_route(sock):
    @sock.route("/api/kafka-logs/ws")
    def kafka_logs_ws(ws):
        with _clients_lock:
            _clients.add(ws)
            current_status = _last_kafka_status.copy()
        # Send current Kafka status immediately to the new client
        try:
            ws.send(json.dumps({
                "topic": "__status__",
                "ts": time.time(),
                "raw": current_status,
            }))
        except Exception:
            pass
        try:
            while True:
                msg = ws.receive(timeout=30)
                if msg is None:
                    break
        except Exception:
            pass
        finally:
            with _clients_lock:
                _clients.discard(ws)
