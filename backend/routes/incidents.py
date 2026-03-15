import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
incidents_bp = Blueprint("incidents", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["incidents"]

SEVERITIES = ("low", "medium", "high", "critical")
STATUSES = ("open", "resolved", "ignored")


def _now():
    return datetime.now(timezone.utc)


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


@incidents_bp.route("/api/incidents", methods=["GET"])
def list_incidents():
    try:
        query = {}
        for param in ("project_id", "site_id", "rig_id", "operator_id", "shift_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        for param in ("severity", "status"):
            val = request.args.get(param)
            if val:
                query[param] = val
        critical = request.args.get("critical_incident")
        if critical is not None:
            query["critical_incident"] = critical.lower() == "true"

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("started_at", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_incidents")
        return _err("Erreur base de données", 500)


@incidents_bp.route("/api/incidents/<iid>", methods=["GET"])
def get_incident(iid):
    try:
        doc = _col.find_one({"_id": iid})
        if not doc:
            return _err("Incident introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_incident")
        return _err("Erreur base de données", 500)


@incidents_bp.route("/api/incidents", methods=["POST"])
def create_incident():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "project_id", "site_id", "type", "severity", "started_at", "status"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        if body["severity"] not in SEVERITIES:
            return _err(f"severity invalide ({', '.join(SEVERITIES)})", 400)
        if body["status"] not in STATUSES:
            return _err(f"status invalide ({', '.join(STATUSES)})", 400)

        doc = {
            "_id": body["_id"].strip(),
            "project_id": body["project_id"].strip(),
            "site_id": body["site_id"].strip(),
            "rig_id": body.get("rig_id"),
            "operator_id": body.get("operator_id"),
            "shift_id": body.get("shift_id"),
            "type": body["type"].strip(),
            "severity": body["severity"],
            "critical_incident": bool(body.get("critical_incident", False)),
            "started_at": datetime.fromisoformat(body["started_at"].replace("Z", "+00:00")),
            "resolved_at": (
                datetime.fromisoformat(body["resolved_at"].replace("Z", "+00:00"))
                if body.get("resolved_at")
                else None
            ),
            "resolution_sec": body.get("resolution_sec"),
            "impact": body.get("impact", {}),
            "root_cause": body.get("root_cause"),
            "status": body["status"],
        }
        _col.insert_one(doc)
        return _ok({"incident": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_incident")
        return _err("Erreur base de données", 500)


@incidents_bp.route("/api/incidents/<iid>", methods=["PUT"])
def update_incident(iid):
    try:
        if not _col.find_one({"_id": iid}):
            return _err("Incident introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        if "severity" in body:
            if body["severity"] not in SEVERITIES:
                return _err("severity invalide", 400)
            upd["severity"] = body["severity"]

        if "status" in body:
            if body["status"] not in STATUSES:
                return _err("status invalide", 400)
            upd["status"] = body["status"]

        for field in ("type", "rig_id", "operator_id", "shift_id", "root_cause",
                      "resolution_sec", "impact", "critical_incident"):
            if field in body:
                upd[field] = body[field]

        for dt_field in ("started_at", "resolved_at"):
            if dt_field in body:
                upd[dt_field] = (
                    datetime.fromisoformat(body[dt_field].replace("Z", "+00:00"))
                    if body[dt_field]
                    else None
                )

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": iid}, {"$set": upd})
        return _ok({"incident": _ser(_col.find_one({"_id": iid}))})
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_incident iid=%s", iid)
        return _err("Erreur base de données", 500)


@incidents_bp.route("/api/incidents/<iid>", methods=["DELETE"])
def delete_incident(iid):
    try:
        result = _col.delete_one({"_id": iid})
        if result.deleted_count == 0:
            return _err("Incident introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_incident iid=%s", iid)
        return _err("Erreur base de données", 500)
