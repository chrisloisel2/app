from flask import Blueprint, jsonify, request
import nas_client
import kpi_engine
import cache_manager

kpis_bp = Blueprint("kpis", __name__)


def _all_metadata() -> list[dict]:
    """Load all session metadata from cache (per-session TTL 5min)."""
    return cache_manager.get_all_metadata(nas_client.list_sessions, nas_client._read_metadata_raw)


@kpis_bp.route("/api/kpis/overview", methods=["GET"])
def kpis_overview():
    try:
        return jsonify(cache_manager.get_kpi("overview", lambda: kpi_engine.compute_overview(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/daily", methods=["GET"])
def kpis_daily():
    days = max(1, min(int(request.args.get("days", 30)), 365))
    try:
        return jsonify({"days": cache_manager.get_kpi(f"daily_{days}", lambda: kpi_engine.compute_daily(_all_metadata(), days))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/operators", methods=["GET"])
def kpis_operators():
    try:
        return jsonify({"operators": cache_manager.get_kpi("operators", lambda: kpi_engine.compute_by_operator(_all_metadata()))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/shifts", methods=["GET"])
def kpis_shifts():
    try:
        return jsonify({"shifts": cache_manager.get_kpi("shifts", lambda: kpi_engine.compute_by_shift(_all_metadata()))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/rigs", methods=["GET"])
def kpis_rigs():
    try:
        return jsonify(cache_manager.get_kpi("rigs", lambda: kpi_engine.compute_by_rig(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/annotation", methods=["GET"])
def kpis_annotation():
    try:
        return jsonify(cache_manager.get_kpi("annotation", lambda: kpi_engine.compute_annotation(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/staffing", methods=["GET"])
def kpis_staffing():
    try:
        return jsonify(cache_manager.get_kpi("staffing", lambda: kpi_engine.compute_staffing(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/incidents", methods=["GET"])
def kpis_incidents():
    try:
        return jsonify(cache_manager.get_kpi("incidents", lambda: kpi_engine.compute_incidents(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/data-integrity", methods=["GET"])
def kpis_data_integrity():
    try:
        return jsonify(cache_manager.get_kpi("data_integrity", lambda: kpi_engine.compute_data_integrity(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/finance", methods=["GET"])
def kpis_finance():
    try:
        return jsonify(cache_manager.get_kpi("finance", lambda: kpi_engine.compute_finance(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@kpis_bp.route("/api/kpis/production", methods=["GET"])
def kpis_production():
    try:
        return jsonify(cache_manager.get_kpi("production", lambda: kpi_engine.compute_production(_all_metadata())))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
