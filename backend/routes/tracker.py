from flask import Blueprint, jsonify, request
import nas_client

tracker_bp = Blueprint("tracker", __name__)

TRACKER_COORD_FIELDS = {
    "1": ["tracker_1_x", "tracker_1_y", "tracker_1_z",
          "tracker_1_qw", "tracker_1_qx", "tracker_1_qy", "tracker_1_qz"],
    "2": ["tracker_2_x", "tracker_2_y", "tracker_2_z",
          "tracker_2_qw", "tracker_2_qx", "tracker_2_qy", "tracker_2_qz"],
    "3": ["tracker_3_x", "tracker_3_y", "tracker_3_z",
          "tracker_3_qw", "tracker_3_qx", "tracker_3_qy", "tracker_3_qz"],
}


@tracker_bp.route("/api/sessions/<session_id>/tracker", methods=["GET"])
def get_tracker_data(session_id: str):
    """
    Paginated tracker positions for a session.
    Query params: limit (default 100), offset (default 0), tracker_num (1|2|3)
    """
    limit       = max(1, min(int(request.args.get("limit", 100)), 100))
    offset      = max(0, int(request.args.get("offset", 0)))
    tracker_num = request.args.get("tracker_num")

    if not nas_client.session_exists(session_id):
        return jsonify({"error": f"Session '{session_id}' introuvable"}), 404

    try:
        rows = nas_client.get_tracker_rows(session_id, limit=limit, offset=offset)

        # Filter to a specific tracker if requested
        if tracker_num in TRACKER_COORD_FIELDS:
            keep = {"timestamp", "time_seconds", "frame_number"} | set(TRACKER_COORD_FIELDS[tracker_num])
            alias_map = {
                f"tracker_{tracker_num}_x":  "x",
                f"tracker_{tracker_num}_y":  "y",
                f"tracker_{tracker_num}_z":  "z",
                f"tracker_{tracker_num}_qw": "qw",
                f"tracker_{tracker_num}_qx": "qx",
                f"tracker_{tracker_num}_qy": "qy",
                f"tracker_{tracker_num}_qz": "qz",
            }
            filtered = []
            for row in rows:
                new_row = {}
                for k, v in row.items():
                    if k not in keep:
                        continue
                    new_row[alias_map.get(k, k)] = v
                filtered.append(new_row)
            rows = filtered

        return jsonify({"session_id": session_id, "data": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
