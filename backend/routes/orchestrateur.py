from flask import Blueprint, jsonify
from orchestrateur_consumer import get_orchestrateur_snapshot

orchestrateur_bp = Blueprint("orchestrateur", __name__)


@orchestrateur_bp.get("/api/orchestrateur")
def orchestrateur():
    """Snapshot temps-réel des individus (topic1)."""
    return jsonify(get_orchestrateur_snapshot())
