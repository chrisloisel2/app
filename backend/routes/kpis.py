from flask import Blueprint, jsonify, request
import nas_client
import kpi_engine

kpis_bp = Blueprint("kpis", __name__)


def _load_all_metadata() -> list[dict]:
    """Load all session metadata.json. Inject _session_id. Skip missing."""
    session_ids = nas_client.list_sessions()
    result = []
    for sid in session_ids:
        try:
            meta = nas_client.read_metadata(sid)
            meta["_session_id"] = sid
            result.append(meta)
        except Exception:
            pass
    return result


@kpis_bp.route("/api/kpis/overview", methods=["GET"])
def kpis_overview():
    try:
        return jsonify(kpi_engine.compute_overview(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/daily", methods=["GET"])
def kpis_daily():
    days = max(1, min(int(request.args.get("days", 30)), 365))
    try:
        return jsonify({"days": kpi_engine.compute_daily(_load_all_metadata(), days)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/operators", methods=["GET"])
def kpis_operators():
    try:
        return jsonify({"operators": kpi_engine.compute_by_operator(_load_all_metadata())})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/shifts", methods=["GET"])
def kpis_shifts():
    try:
        return jsonify({"shifts": kpi_engine.compute_by_shift(_load_all_metadata())})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/rigs", methods=["GET"])
def kpis_rigs():
    try:
        return jsonify(kpi_engine.compute_by_rig(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/annotation", methods=["GET"])
def kpis_annotation():
    try:
        return jsonify(kpi_engine.compute_annotation(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/staffing", methods=["GET"])
def kpis_staffing():
    try:
        return jsonify(kpi_engine.compute_staffing(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/incidents", methods=["GET"])
def kpis_incidents():
    try:
        return jsonify(kpi_engine.compute_incidents(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/data-integrity", methods=["GET"])
def kpis_data_integrity():
    try:
        return jsonify(kpi_engine.compute_data_integrity(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/finance", methods=["GET"])
def kpis_finance():
    try:
        return jsonify(kpi_engine.compute_finance(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/production", methods=["GET"])
def kpis_production():
    try:
        return jsonify(kpi_engine.compute_production(_load_all_metadata()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
