from flask import Blueprint, jsonify
import nas_client
import cache_manager

metadata_bp = Blueprint("metadata", __name__)


@metadata_bp.route("/api/metadata/sessions", methods=["GET"])
def list_sessions_metadata():
    """Return metadata.json for each session directory on the NAS. Cached."""
    try:
        session_ids = nas_client.list_sessions()
        rows = []
        dynamic_keys = set()

        for sid in session_ids:
            metadata = None
            metadata_error = None
            try:
                metadata = cache_manager.get_session_metadata(
                    sid, lambda s=sid: nas_client._read_metadata_raw(s)
                )
                dynamic_keys.update(metadata.keys())
            except Exception as e:
                metadata_error = str(e)

            rows.append({
                "session_dir": sid,
                "metadata": metadata,
                "metadata_error": metadata_error,
            })

        keys = sorted(dynamic_keys)
        return jsonify({"sessions": rows, "count": len(rows), "keys": keys})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metadata_bp.route("/api/metadata/sessions/<session_id>", methods=["GET"])
def get_session_metadata(session_id: str):
    if not nas_client.session_exists(session_id):
        return jsonify({"error": f"Session '{session_id}' introuvable"}), 404
    try:
        metadata = nas_client.read_metadata(session_id)
        session_dir = session_id if session_id.startswith("session_") else f"session_{session_id}"
        return jsonify({
            "session_dir": session_dir,
            "metadata": metadata,
            "metadata_error": None,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
