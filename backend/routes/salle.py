import json
import threading

from flask import Blueprint, jsonify

from kafka_consumer import get_stations_snapshot

salle_bp = Blueprint("salle", __name__)

# ── Client registry ───────────────────────────────────────────────────────────
_clients: set = set()
_clients_lock = threading.Lock()


def notify_ws():
    """Push a fresh snapshot to all connected WebSocket clients."""
    snapshot = json.dumps(get_stations_snapshot())
    with _clients_lock:
        dead = set()
        for ws in _clients:
            try:
                ws.send(snapshot)
            except Exception:
                dead.add(ws)
        _clients.difference_update(dead)


def register_ws_route(sock):
    """Called from app.py to attach the WS route to the flask-sock instance."""

    @sock.route("/api/salle/ws")
    def salle_ws(ws):
        # Send current snapshot immediately on connect
        ws.send(json.dumps(get_stations_snapshot()))
        with _clients_lock:
            _clients.add(ws)
        try:
            while True:
                msg = ws.receive(timeout=30)
                if msg is None:
                    break   # client disconnected cleanly
        except Exception:
            pass
        finally:
            with _clients_lock:
                _clients.discard(ws)


# ── REST fallback ─────────────────────────────────────────────────────────────
@salle_bp.get("/api/salle")
def salle():
    return jsonify(get_stations_snapshot())
