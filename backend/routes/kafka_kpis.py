"""
kafka_kpis.py
=============
Routes API pour les KPIs temps réel calculés depuis les événements Kafka.

GET  /api/kafka-kpis/live            — snapshot global instantané
WS   /api/kafka-kpis/ws             — stream temps réel (snapshot à chaque event)
GET  /api/kafka-kpis/sessions        — toutes les sessions vues (in-memory)
GET  /api/kafka-kpis/sessions/pending — sessions non encore uploadées
GET  /api/kafka-kpis/operators       — stats complètes par opérateur (in-memory)
GET  /api/kafka-kpis/operators/<op>  — stats d'un opérateur spécifique
GET  /api/kafka-kpis/operators/db    — stats opérateurs depuis MongoDB (historique)
GET  /api/kafka-kpis/history         — snapshots périodiques depuis MongoDB
"""

import time
from flask import Blueprint, jsonify, request
from pymongo import DESCENDING, ASCENDING
import kafka_kpi_engine
from db import get_col as _db_get_col

kafka_kpis_bp = Blueprint("kafka_kpis", __name__)


def register_ws_route(sock):
    """Called from app.py to attach the KPI WebSocket route."""
    import json

    @sock.route("/api/kafka-kpis/ws")
    def kafka_kpis_ws(ws):
        # Send current snapshot immediately on connect
        ws.send(json.dumps(kafka_kpi_engine.get_snapshot()))
        kafka_kpi_engine.register_ws_client(ws)
        try:
            while True:
                msg = ws.receive(timeout=30)
                if msg is None:
                    break
        except Exception:
            pass
        finally:
            kafka_kpi_engine.unregister_ws_client(ws)


def _get_col(collection: str):
    return _db_get_col("physical_data", collection)


# ── Live snapshot ─────────────────────────────────────────────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/live", methods=["GET"])
def kafka_kpis_live():
    """Snapshot KPI global temps réel (in-memory)."""
    return jsonify(kafka_kpi_engine.get_snapshot())


# ── Sessions ──────────────────────────────────────────────────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/sessions", methods=["GET"])
def kafka_sessions():
    """
    Toutes les sessions vues depuis le démarrage du backend.
    Query params: operator, station_id, upload_status (pending|uploaded), date
    """
    sessions = kafka_kpi_engine.get_sessions_snapshot()

    if request.args.get("operator"):
        sessions = [s for s in sessions if s.get("operator") == request.args["operator"]]
    if request.args.get("station_id"):
        sessions = [s for s in sessions if s.get("station_id") == request.args["station_id"]]
    if request.args.get("upload_status"):
        sessions = [s for s in sessions if s.get("upload_status") == request.args["upload_status"]]
    if request.args.get("date"):
        sessions = [s for s in sessions if s.get("date") == request.args["date"]]

    sessions = sorted(sessions, key=lambda s: s.get("ts_stop", 0), reverse=True)
    return jsonify({"count": len(sessions), "sessions": sessions})


@kafka_kpis_bp.route("/api/kafka-kpis/sessions/pending", methods=["GET"])
def kafka_sessions_pending():
    """Sessions enregistrées sur les postes mais pas encore uploadées."""
    pending = kafka_kpi_engine.get_pending_sessions()
    pending = sorted(pending, key=lambda s: s.get("ts_stop", 0), reverse=True)
    return jsonify({
        "count":             len(pending),
        "total_duration_h":  round(sum(s.get("duration_s", 0) for s in pending) / 3600, 2),
        "sessions":          pending,
    })


# ── Operator stats (in-memory) ────────────────────────────────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/operators", methods=["GET"])
def kafka_operators():
    """
    Stats complètes de tous les opérateurs depuis le démarrage du backend.
    Retourne: par jour, par heure, par mois + totaux.
    """
    stats = kafka_kpi_engine.get_operator_stats()

    # Build summary list (all operators)
    summary = []
    for op, data in stats.items():
        summary.append({
            "operator":       op,
            "total_sessions": data["total_sessions"],
            "total_duration_h": data["total_duration_h"],
            "total_failed":   data["total_failed"],
            "fail_rate_pct":  round(
                data["total_failed"] / data["total_sessions"] * 100, 1
            ) if data["total_sessions"] else None,
        })
    summary.sort(key=lambda x: x["total_sessions"], reverse=True)

    return jsonify({
        "operators_count": len(stats),
        "summary":         summary,
        "detail":          stats,
    })


@kafka_kpis_bp.route("/api/kafka-kpis/operators/<operator>", methods=["GET"])
def kafka_operator_detail(operator: str):
    """Stats détaillées d'un opérateur (in-memory)."""
    stats = kafka_kpi_engine.get_operator_stats()
    data  = stats.get(operator)
    if not data:
        return jsonify({"error": f"Opérateur '{operator}' inconnu ou aucune session"}), 404

    # Enrich: ajoute duration_h partout
    by_day = {
        day: {
            **v,
            "duration_h": round(v["duration_s"] / 3600, 3),
        }
        for day, v in data["by_day"].items()
    }
    by_hour = {
        h: {
            **v,
            "duration_h": round(v["duration_s"] / 3600, 3),
            "label":      f"{int(h):02d}h",
        }
        for h, v in data["by_hour"].items()
    }
    by_month = {
        month: {
            **v,
            "duration_h": round(v["duration_s"] / 3600, 3),
        }
        for month, v in data["by_month"].items()
    }

    return jsonify({
        "operator":         operator,
        "total_sessions":   data["total_sessions"],
        "total_duration_h": data["total_duration_h"],
        "total_failed":     data["total_failed"],
        "by_day":           by_day,
        "by_hour":          by_hour,
        "by_month":         by_month,
    })


# ── Operator stats (MongoDB — historique multi-sessions) ──────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/operators/db", methods=["GET"])
def kafka_operators_db():
    """
    Stats opérateurs depuis MongoDB (kafka_operator_stats).
    Survit aux redémarrages du backend — historique complet.

    Query params:
      operator   — filtre sur un opérateur
      date_from  — "YYYY-MM-DD"
      date_to    — "YYYY-MM-DD"
      month      — "YYYY-MM"
      group_by   — "day" (défaut) | "month" | "operator"
    """
    try:
        col = _get_col(kafka_kpi_engine.MONGO_OP_STATS_COL)

        filt: dict = {}
        if request.args.get("operator"):
            filt["operator"] = request.args["operator"]
        if request.args.get("month"):
            filt["month"] = request.args["month"]
        if request.args.get("date_from") or request.args.get("date_to"):
            filt["date"] = {}
            if request.args.get("date_from"):
                filt["date"]["$gte"] = request.args["date_from"]
            if request.args.get("date_to"):
                filt["date"]["$lte"] = request.args["date_to"]

        docs = list(col.find(filt, {"_id": 0}, sort=[("date", DESCENDING)], limit=5000))

        group_by = request.args.get("group_by", "day")

        if group_by == "operator":
            # Aggrège toutes les dates par opérateur
            agg: dict = {}
            for d in docs:
                op = d["operator"]
                e  = agg.setdefault(op, {"operator": op, "sessions": 0,
                                         "duration_h": 0.0, "failed": 0})
                e["sessions"]   += d.get("sessions", 0)
                e["duration_h"] += d.get("duration_h", 0.0)
                e["failed"]     += d.get("failed", 0)
            result = sorted(agg.values(), key=lambda x: x["sessions"], reverse=True)

        elif group_by == "month":
            agg = {}
            for d in docs:
                key = (d["operator"], d["month"])
                e   = agg.setdefault(key, {"operator": d["operator"], "month": d["month"],
                                           "sessions": 0, "duration_h": 0.0, "failed": 0})
                e["sessions"]   += d.get("sessions", 0)
                e["duration_h"] += d.get("duration_h", 0.0)
                e["failed"]     += d.get("failed", 0)
            result = sorted(agg.values(), key=lambda x: (x["month"], x["operator"]))

        else:  # day
            result = docs

        # Round duration_h
        for r in result:
            if "duration_h" in r:
                r["duration_h"] = round(r["duration_h"], 3)
            if "sessions" in r and r["sessions"] > 0 and "failed" in r:
                r["fail_rate_pct"] = round(r["failed"] / r["sessions"] * 100, 1)

        return jsonify({"count": len(result), "group_by": group_by, "rows": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Sessions depuis MongoDB (historique) ──────────────────────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/sessions/db", methods=["GET"])
def kafka_sessions_db():
    """
    Sessions persistées en MongoDB (kafka_sessions).
    Query params: operator, station_id, upload_status, date, date_from, date_to, limit
    """
    try:
        col  = _get_col(kafka_kpi_engine.MONGO_SESSIONS_COL)
        filt: dict = {}

        if request.args.get("operator"):
            filt["operator"] = request.args["operator"]
        if request.args.get("station_id"):
            filt["station_id"] = request.args["station_id"]
        if request.args.get("upload_status"):
            filt["upload_status"] = request.args["upload_status"]
        if request.args.get("date"):
            filt["date"] = request.args["date"]
        if request.args.get("date_from") or request.args.get("date_to"):
            filt["date"] = {}
            if request.args.get("date_from"):
                filt["date"]["$gte"] = request.args["date_from"]
            if request.args.get("date_to"):
                filt["date"]["$lte"] = request.args["date_to"]

        limit = min(int(request.args.get("limit", 500)), 5000)
        docs  = list(col.find(filt, {"_id": 0}, sort=[("ts_stop", DESCENDING)], limit=limit))
        total_h = round(sum(d.get("duration_s", 0) for d in docs) / 3600, 2)
        pending = sum(1 for d in docs if d.get("upload_status") == "pending")

        return jsonify({
            "count":            len(docs),
            "total_duration_h": total_h,
            "pending_upload":   pending,
            "sessions":         docs,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Snapshot history ──────────────────────────────────────────────────────────

@kafka_kpis_bp.route("/api/kafka-kpis/history", methods=["GET"])
def kafka_kpis_history():
    """
    Historique des snapshots périodiques MongoDB.
    Query params: limit (max 1000), hours (max 720)
    """
    limit = max(1, min(int(request.args.get("limit", 100)), 1000))
    hours = max(1, min(int(request.args.get("hours", 24)), 720))
    try:
        col      = _get_col(kafka_kpi_engine.MONGO_COLLECTION)
        cutoff   = time.time() - hours * 3600
        docs     = list(col.find({"ts": {"$gte": cutoff}}, {"_id": 0},
                                  sort=[("ts", DESCENDING)], limit=limit))
        return jsonify({"count": len(docs), "hours": hours, "snapshots": docs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
