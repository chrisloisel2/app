"""
session_stats.py
================
Ingestion et consultation des statistiques de sessions déjà enregistrées.

Collection MongoDB : session_stats (base physical_data)

Route d'ingestion :
  POST /api/session-stats          — une session
  POST /api/session-stats/batch    — tableau de sessions

Routes de consultation :
  GET  /api/session-stats          — liste (filtres, agrégations)
  GET  /api/session-stats/charts   — données pré-agrégées pour les graphiques
"""

from flask import Blueprint, jsonify, request
from pymongo import ASCENDING, DESCENDING
from datetime import datetime, timezone
import re
from db import get_col as _db_col

session_stats_bp = Blueprint("session_stats", __name__)

COLLECTION = "session_stats"

# ── Regex pour extraire la date depuis session_id ────────────────────────────
_DATE_RE  = re.compile(r"session_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})")
_DATE2_RE = re.compile(r"session_(\d{4})(\d{2})(\d{2})")


def _get_col():
    return _db_col("physical_data", COLLECTION)


def _parse_session_date(session_id: str) -> dict:
    """Extract date/time components from session_id."""
    m = _DATE_RE.search(session_id)
    if m:
        y, mo, d, h, mi, s = m.groups()
        return {
            "date":  f"{y}-{mo}-{d}",
            "hour":  int(h),
            "year":  int(y),
            "month": int(mo),
            "day":   int(d),
        }
    m = _DATE2_RE.search(session_id)
    if m:
        y, mo, d = m.groups()
        return {
            "date":  f"{y}-{mo}-{d}",
            "hour":  None,
            "year":  int(y),
            "month": int(mo),
            "day":   int(d),
        }
    return {}


def _validate_and_enrich(doc: dict) -> dict | None:
    """Validate required fields and enrich with parsed date."""
    session_id = doc.get("session_id")
    if not session_id:
        return None

    enriched = dict(doc)

    # Parse date from session_id if not provided
    if not enriched.get("date"):
        parsed = _parse_session_date(session_id)
        enriched.update(parsed)

    # Ensure _id = session_id for idempotent upserts
    enriched["_id"] = session_id

    # Ingested at
    if "ingested_at" not in enriched:
        enriched["ingested_at"] = datetime.now(timezone.utc).isoformat()

    return enriched


# ── Ingestion ─────────────────────────────────────────────────────────────────

@session_stats_bp.route("/api/session-stats", methods=["POST"])
def ingest_one():
    """
    Ingest one session.
    Idempotent: upserts on session_id.
    """
    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"error": "body JSON requis"}), 400

    doc = _validate_and_enrich(body)
    if not doc:
        return jsonify({"error": "session_id requis"}), 400

    col = _get_col()
    col.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    return jsonify({"ok": True, "session_id": doc["_id"]}), 201


@session_stats_bp.route("/api/session-stats/batch", methods=["POST"])
def ingest_batch():
    """
    Ingest a list of sessions.
    Body: list of session objects OR {"sessions": [...]}
    Idempotent: upserts on session_id.
    """
    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"error": "body JSON requis"}), 400

    sessions = body if isinstance(body, list) else body.get("sessions", [])
    if not sessions:
        return jsonify({"error": "liste de sessions vide"}), 400

    col = _get_col()
    ok, errors = 0, []

    for raw in sessions:
        doc = _validate_and_enrich(raw)
        if not doc:
            errors.append({"session_id": raw.get("session_id"), "error": "session_id manquant"})
            continue
        try:
            col.replace_one({"_id": doc["_id"]}, doc, upsert=True)
            ok += 1
        except Exception as e:
            errors.append({"session_id": doc.get("_id"), "error": str(e)})

    return jsonify({"ok": True, "inserted": ok, "errors": errors}), 201


# ── Consultation ──────────────────────────────────────────────────────────────

@session_stats_bp.route("/api/session-stats", methods=["GET"])
def list_sessions():
    """
    List sessions with optional filters.
    Query params: date, date_from, date_to, station_id, operator, scenario, limit (def 500)
    """
    col = _get_col()
    filt = {}

    if request.args.get("date"):
        filt["date"] = request.args["date"]
    if request.args.get("date_from") or request.args.get("date_to"):
        filt["date"] = {}
        if request.args.get("date_from"):
            filt["date"]["$gte"] = request.args["date_from"]
        if request.args.get("date_to"):
            filt["date"]["$lte"] = request.args["date_to"]
    if request.args.get("station_id"):
        filt["station_id"] = request.args["station_id"]
    if request.args.get("operator"):
        filt["operator"] = request.args["operator"]
    if request.args.get("scenario"):
        filt["scenario"] = request.args["scenario"]

    limit = min(int(request.args.get("limit", 500)), 5000)
    docs = list(col.find(filt, {"_id": 0}, sort=[("date", DESCENDING), ("hour", DESCENDING)], limit=limit))
    return jsonify({"count": len(docs), "sessions": docs})


@session_stats_bp.route("/api/session-stats/charts", methods=["GET"])
def charts_data():
    """
    Pre-aggregated data for all chart views.
    Query params: date_from, date_to
    Returns: by_day, by_hour, by_scenario, by_station, totals
    """
    col = _get_col()
    filt = {}
    if request.args.get("date_from") or request.args.get("date_to"):
        filt["date"] = {}
        if request.args.get("date_from"):
            filt["date"]["$gte"] = request.args["date_from"]
        if request.args.get("date_to"):
            filt["date"]["$lte"] = request.args["date_to"]

    docs = list(col.find(filt, {"_id": 0}))
    if not docs:
        return jsonify({"by_day": [], "by_hour": [], "by_scenario": [], "by_station": [], "totals": {}})

    # ── by_day ────────────────────────────────────────────────────────────────
    day_map: dict = {}
    for d in docs:
        day = d.get("date")
        if not day:
            continue
        e = day_map.setdefault(day, {"date": day, "sessions": 0, "duration_s": 0.0,
                                      "size_gb": 0.0, "failed": 0, "upload_ok": 0})
        e["sessions"]   += 1
        e["duration_s"] += float(d.get("duration_s") or 0)
        e["size_gb"]    += float(d.get("size_gb")    or 0)
        if d.get("failed"):
            e["failed"] += 1
        if d.get("upload_success"):
            e["upload_ok"] += 1

    by_day = sorted(day_map.values(), key=lambda x: x["date"])
    for e in by_day:
        e["duration_h"]    = round(e["duration_s"] / 3600, 2)
        e["size_gb"]       = round(e["size_gb"], 3)
        e["success_rate"]  = round(e["upload_ok"] / e["sessions"] * 100, 1) if e["sessions"] else None

    # ── by_hour ───────────────────────────────────────────────────────────────
    hour_map: dict = {}
    for d in docs:
        h = d.get("hour")
        if h is None:
            continue
        e = hour_map.setdefault(h, {"hour": h, "sessions": 0, "duration_s": 0.0, "size_gb": 0.0})
        e["sessions"]   += 1
        e["duration_s"] += float(d.get("duration_s") or 0)
        e["size_gb"]    += float(d.get("size_gb")    or 0)

    by_hour = sorted(hour_map.values(), key=lambda x: x["hour"])
    for e in by_hour:
        e["duration_h"] = round(e["duration_s"] / 3600, 2)
        e["size_gb"]    = round(e["size_gb"], 3)
        e["label"]      = f"{e['hour']:02d}h"

    # ── by_scenario ───────────────────────────────────────────────────────────
    sc_map: dict = {}
    for d in docs:
        sc = d.get("scenario") or "inconnu"
        e = sc_map.setdefault(sc, {"scenario": sc, "sessions": 0, "duration_s": 0.0,
                                    "size_gb": 0.0, "failed": 0})
        e["sessions"]   += 1
        e["duration_s"] += float(d.get("duration_s") or 0)
        e["size_gb"]    += float(d.get("size_gb")    or 0)
        if d.get("failed"):
            e["failed"] += 1

    by_scenario = sorted(sc_map.values(), key=lambda x: x["sessions"], reverse=True)
    for e in by_scenario:
        e["duration_h"]   = round(e["duration_s"] / 3600, 2)
        e["size_gb"]      = round(e["size_gb"], 3)
        e["fail_rate_pct"] = round(e["failed"] / e["sessions"] * 100, 1) if e["sessions"] else None

    # ── by_station ────────────────────────────────────────────────────────────
    sta_map: dict = {}
    for d in docs:
        sta = d.get("station_id") or "?"
        e = sta_map.setdefault(sta, {"station_id": sta, "sessions": 0, "duration_s": 0.0,
                                      "size_gb": 0.0})
        e["sessions"]   += 1
        e["duration_s"] += float(d.get("duration_s") or 0)
        e["size_gb"]    += float(d.get("size_gb")    or 0)

    by_station = sorted(sta_map.values(), key=lambda x: x["sessions"], reverse=True)
    for e in by_station:
        e["duration_h"] = round(e["duration_s"] / 3600, 2)
        e["size_gb"]    = round(e["size_gb"], 3)

    # ── totals ────────────────────────────────────────────────────────────────
    total_sessions  = len(docs)
    total_duration  = sum(float(d.get("duration_s") or 0) for d in docs)
    total_size      = sum(float(d.get("size_gb")    or 0) for d in docs)
    total_failed    = sum(1 for d in docs if d.get("failed"))
    total_upload_ok = sum(1 for d in docs if d.get("upload_success"))

    totals = {
        "sessions":          total_sessions,
        "duration_h":        round(total_duration / 3600, 2),
        "size_gb":           round(total_size, 3),
        "failed":            total_failed,
        "upload_ok":         total_upload_ok,
        "success_rate_pct":  round(total_upload_ok / total_sessions * 100, 1) if total_sessions else None,
        "avg_duration_s":    round(total_duration / total_sessions, 1) if total_sessions else None,
        "avg_size_gb":       round(total_size / total_sessions, 3) if total_sessions else None,
    }

    return jsonify({
        "by_day":      by_day,
        "by_hour":     by_hour,
        "by_scenario": by_scenario,
        "by_station":  by_station,
        "totals":      totals,
    })
