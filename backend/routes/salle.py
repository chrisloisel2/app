import json
import threading
import time

from flask import Blueprint, Response, jsonify

from kafka_consumer import get_state_snapshot

salle_bp = Blueprint("salle", __name__)

# ── SSE broadcast mechanism ───────────────────────────────────────────────────
# The Kafka consumer calls _notify() every time it processes a message.
# SSE clients wait on _condition and get woken up to send the new snapshot.

_condition = threading.Condition()


def notify_sse():
    """Called by the Kafka consumer each time state changes."""
    with _condition:
        _condition.notify_all()


# ── REST fallback ─────────────────────────────────────────────────────────────
@salle_bp.get("/api/salle")
def salle():
    """Snapshot temps-réel de la salle de récolte (topic2)."""
    return jsonify(get_state_snapshot())


# ── SSE stream ────────────────────────────────────────────────────────────────
@salle_bp.get("/api/salle/stream")
def salle_stream():
    """
    Server-Sent Events stream.
    Pushes a fresh snapshot whenever Kafka delivers a new message.
    Falls back to a 30-second heartbeat if nothing arrives.
    """
    def generate():
        # Send initial snapshot immediately so the client doesn't wait
        snapshot = get_state_snapshot()
        yield f"data: {json.dumps(snapshot)}\n\n"

        while True:
            with _condition:
                notified = _condition.wait(timeout=30)  # heartbeat every 30s

            snapshot = get_state_snapshot()
            if notified:
                yield f"data: {json.dumps(snapshot)}\n\n"
            else:
                # heartbeat — keep connection alive, still send latest state
                yield f"data: {json.dumps(snapshot)}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )
