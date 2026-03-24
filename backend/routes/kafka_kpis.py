from flask import Blueprint, jsonify, request
import kafka_kpi_engine

kafka_kpis_bp = Blueprint("kafka_kpis", __name__)


@kafka_kpis_bp.route("/api/kafka-kpis/live", methods=["GET"])
def kafka_kpis_live():
    """Snapshot KPI temps réel calculé depuis les événements Kafka in-memory."""
    return jsonify(kafka_kpi_engine.get_snapshot())


@kafka_kpis_bp.route("/api/kafka-kpis/history", methods=["GET"])
def kafka_kpis_history():
    """
    Historique des snapshots persistés en MongoDB.
    Query params :
      limit  (int, défaut 100, max 1000)
      hours  (int, défaut 24) — fenêtre temporelle
    """
    limit = max(1, min(int(request.args.get("limit", 100)), 1000))
    hours = max(1, min(int(request.args.get("hours", 24)), 720))

    try:
        import time
        from pymongo import MongoClient
        from config import MONGODB_URI
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        col = client["physical_data"][kafka_kpi_engine.MONGO_COLLECTION]

        cutoff_ts = time.time() - hours * 3600
        docs = list(
            col.find(
                {"ts": {"$gte": cutoff_ts}},
                {"_id": 0},
                sort=[("ts", -1)],
                limit=limit,
            )
        )
        return jsonify({"count": len(docs), "hours": hours, "snapshots": docs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
