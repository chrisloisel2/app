from flask import Blueprint, jsonify
import nas_client

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/sessions", methods=["GET"])
def list_sessions():
    """List all sessions available on the NAS."""
    try:
        session_ids = nas_client.list_sessions()
        rows = [{"session_id": sid} for sid in session_ids]
        return jsonify({"sessions": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sessions_bp.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id: str):
    """Summary stats for a single session (tracker + pinces)."""
    if not nas_client.session_exists(session_id):
        return jsonify({"error": f"Session '{session_id}' introuvable"}), 404
    try:
        tracker_stats = nas_client.get_tracker_stats(session_id)
        pince_stats   = nas_client.get_pince_stats(session_id)
        return jsonify({
            "session_id":    session_id,
            "tracker_stats": tracker_stats,
            "pince_stats":   pince_stats,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
