from flask import Blueprint, jsonify
from kafka_consumer import get_stations_snapshot

orchestrateur_bp = Blueprint("orchestrateur", __name__)


@orchestrateur_bp.get("/api/orchestrateur")
def orchestrateur():
    """Snapshot temps-réel des stations (KafkaEventPublisher, monitoring)."""
    return jsonify(get_stations_snapshot())
