import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
cost_events_bp = Blueprint("cost_events", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["cost_events"]


def _ser(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = {sk: sv.isoformat() if isinstance(sv, datetime) else sv for sk, sv in v.items()}
        else:
            out[k] = v
    return out


def _ok(data=None, status=200):
    payload = {"ok": True}
    if data:
        payload.update(data)
    return jsonify(payload), status


def _err(msg, status=400):
    return jsonify({"ok": False, "error": msg}), status


@cost_events_bp.route("/api/cost-events", methods=["GET"])
def list_cost_events():
    try:
        query = {}
        for param in ("project_id", "site_id", "shift_id", "operator_id", "date"):
            val = request.args.get(param)
            if val:
                query[param] = val

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort([("date", -1)]).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_cost_events")
        return _err("Erreur base de données", 500)


@cost_events_bp.route("/api/cost-events/<cid>", methods=["GET"])
def get_cost_event(cid):
    try:
        doc = _col.find_one({"_id": cid})
        if not doc:
            return _err("Événement de coût introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_cost_event")
        return _err("Erreur base de données", 500)


@cost_events_bp.route("/api/cost-events", methods=["POST"])
def create_cost_event():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "date", "project_id", "site_id", "currency"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        doc = {
            "_id": body["_id"].strip(),
            "date": body["date"].strip(),
            "project_id": body["project_id"].strip(),
            "site_id": body["site_id"].strip(),
            "shift_id": body.get("shift_id"),
            "operator_id": body.get("operator_id"),
            "costs": body.get("costs", {}),
            "currency": body["currency"].strip(),
            "source": body.get("source"),
        }
        _col.insert_one(doc)
        return _ok({"cost_event": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except PyMongoError:
        logger.exception("create_cost_event")
        return _err("Erreur base de données", 500)


@cost_events_bp.route("/api/cost-events/<cid>", methods=["PUT"])
def update_cost_event(cid):
    try:
        if not _col.find_one({"_id": cid}):
            return _err("Événement de coût introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("date", "project_id", "site_id", "shift_id", "operator_id",
                      "costs", "currency", "source"):
            if field in body:
                upd[field] = body[field]

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": cid}, {"$set": upd})
        return _ok({"cost_event": _ser(_col.find_one({"_id": cid}))})
    except PyMongoError:
        logger.exception("update_cost_event cid=%s", cid)
        return _err("Erreur base de données", 500)


@cost_events_bp.route("/api/cost-events/<cid>", methods=["DELETE"])
def delete_cost_event(cid):
    try:
        result = _col.delete_one({"_id": cid})
        if result.deleted_count == 0:
            return _err("Événement de coût introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_cost_event cid=%s", cid)
        return _err("Erreur base de données", 500)
