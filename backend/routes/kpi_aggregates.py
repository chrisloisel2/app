import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
kpi_aggregates_bp = Blueprint("kpi_aggregates", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["kpi_aggregates"]

GRAINS = ("hour", "day", "shift", "week", "month")


def _now():
    return datetime.now(timezone.utc)


def _ser(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _ser_dict(v)
        else:
            out[k] = v
    return out


def _ser_dict(d):
    return {
        k: v.isoformat() if isinstance(v, datetime) else (_ser_dict(v) if isinstance(v, dict) else v)
        for k, v in d.items()
    }


def _ok(data=None, status=200):
    payload = {"ok": True}
    if data:
        payload.update(data)
    return jsonify(payload), status


def _err(msg, status=400):
    return jsonify({"ok": False, "error": msg}), status


@kpi_aggregates_bp.route("/api/kpi-aggregates", methods=["GET"])
def list_kpi_aggregates():
    try:
        query = {}
        grain = request.args.get("grain")
        if grain:
            query["grain"] = grain

        for scope_key in ("project_id", "site_id", "shift_id", "operator_id", "rig_id", "annotator_id", "scenario_id"):
            val = request.args.get(scope_key)
            if val:
                query[f"scope.{scope_key}"] = val

        for period_key in ("date", "week", "month"):
            val = request.args.get(period_key)
            if val:
                query[f"period.{period_key}"] = val

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("updated_at", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_kpi_aggregates")
        return _err("Erreur base de données", 500)


@kpi_aggregates_bp.route("/api/kpi-aggregates/<kid>", methods=["GET"])
def get_kpi_aggregate(kid):
    try:
        doc = _col.find_one({"_id": kid})
        if not doc:
            return _err("KPI aggregate introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_kpi_aggregate")
        return _err("Erreur base de données", 500)


@kpi_aggregates_bp.route("/api/kpi-aggregates", methods=["POST"])
def create_kpi_aggregate():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "grain", "scope", "period", "kpis"):
            if not body.get(required) and body.get(required) != {}:
                return _err(f"{required} est requis", 400)

        if body["grain"] not in GRAINS:
            return _err(f"grain invalide ({', '.join(GRAINS)})", 400)

        doc = {
            "_id": body["_id"].strip(),
            "grain": body["grain"],
            "scope": body["scope"],
            "period": body["period"],
            "kpis": body["kpis"],
            "updated_at": _now(),
        }
        _col.insert_one(doc)
        return _ok({"kpi_aggregate": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except PyMongoError as e:
        if "duplicate" in str(e).lower() or "E11000" in str(e):
            return _err("Un KPI aggregate avec cet identifiant existe déjà", 409)
        logger.exception("create_kpi_aggregate")
        return _err("Erreur base de données", 500)


@kpi_aggregates_bp.route("/api/kpi-aggregates/<kid>", methods=["PUT"])
def update_kpi_aggregate(kid):
    try:
        if not _col.find_one({"_id": kid}):
            return _err("KPI aggregate introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {"updated_at": _now()}

        if "grain" in body:
            if body["grain"] not in GRAINS:
                return _err("grain invalide", 400)
            upd["grain"] = body["grain"]

        for field in ("scope", "period", "kpis"):
            if field in body:
                upd[field] = body[field]

        _col.update_one({"_id": kid}, {"$set": upd})
        return _ok({"kpi_aggregate": _ser(_col.find_one({"_id": kid}))})
    except PyMongoError:
        logger.exception("update_kpi_aggregate kid=%s", kid)
        return _err("Erreur base de données", 500)


@kpi_aggregates_bp.route("/api/kpi-aggregates/<kid>", methods=["DELETE"])
def delete_kpi_aggregate(kid):
    try:
        result = _col.delete_one({"_id": kid})
        if result.deleted_count == 0:
            return _err("KPI aggregate introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_kpi_aggregate kid=%s", kid)
        return _err("Erreur base de données", 500)
