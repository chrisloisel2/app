from flask import Blueprint, jsonify, request
import csv
import os
import nas_client
import config

query_bp = Blueprint("query", __name__)

ALLOWED_TABLES = {"tracker_positions", "pince1_data", "pince2_data"}


@query_bp.route("/api/query", methods=["POST"])
def run_query():
    """
    Simple CSV query over NAS files.
    Body: { "session_id": "session_20260222_175519", "table": "tracker_positions", "limit": 100, "offset": 0 }
    Remplace l'ancienne route HiveQL — plus de SQL arbitraire, seulement des lectures paginées.
    """
    body      = request.get_json(force=True) or {}
    session_id = (body.get("session_id") or "").strip()
    table      = (body.get("table") or "").strip()
    limit      = max(1, min(int(body.get("limit", 100)), 1000))
    offset     = max(0, int(body.get("offset", 0)))

    if not session_id:
        return jsonify({"error": "Champ 'session_id' requis"}), 400
    if table not in ALLOWED_TABLES:
        return jsonify({"error": f"Table inconnue. Valeurs acceptées : {sorted(ALLOWED_TABLES)}"}), 400
    if not nas_client.session_exists(session_id):
        return jsonify({"error": f"Session '{session_id}' introuvable"}), 404

    try:
        if table == "tracker_positions":
            rows = nas_client.get_tracker_rows(session_id, limit=limit, offset=offset)
        else:
            rows = nas_client.get_pince_rows(session_id, table, limit=limit, offset=offset)
        return jsonify({"data": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
