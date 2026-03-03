from flask import Blueprint, jsonify, request
import nas_client

pinces_bp = Blueprint("pinces", __name__)


def _pince_route(session_id: str, table: str):
    limit  = max(1, min(int(request.args.get("limit", 100)), 100))
    offset = max(0, int(request.args.get("offset", 0)))

    if not nas_client.session_exists(session_id):
        return jsonify({"error": f"Session '{session_id}' introuvable"}), 404

    try:
        rows = nas_client.get_pince_rows(session_id, table, limit=limit, offset=offset)
        return jsonify({"session_id": session_id, "table": table, "data": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pinces_bp.route("/api/sessions/<session_id>/pince1", methods=["GET"])
def get_pince1(session_id: str):
    return _pince_route(session_id, "pince1_data")


@pinces_bp.route("/api/sessions/<session_id>/pince2", methods=["GET"])
def get_pince2(session_id: str):
    return _pince_route(session_id, "pince2_data")
