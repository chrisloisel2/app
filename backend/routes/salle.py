from flask import Blueprint, jsonify
from kafka_consumer import get_state_snapshot

salle_bp = Blueprint("salle", __name__)


@salle_bp.get("/api/salle")
def salle():
    """Snapshot temps-réel de la salle de récolte (topic2)."""
    return jsonify(get_state_snapshot())
