import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
rig_status_snapshots_bp = Blueprint("rig_status_snapshots", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["rig_status_snapshots"]

STATUSES = ("running", "stopped", "maintenance", "idle")


def _now():
    return datetime.now(timezone.utc)


def _ser(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
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


@rig_status_snapshots_bp.route("/api/rig-status-snapshots", methods=["GET"])
def list_snapshots():
    try:
        query = {}
        for param in ("rig_id", "project_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        status_filter = request.args.get("status")
        if status_filter:
            query["status"] = status_filter

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("timestamp", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_snapshots")
        return _err("Erreur base de données", 500)


@rig_status_snapshots_bp.route("/api/rig-status-snapshots/<sid>", methods=["GET"])
def get_snapshot(sid):
    try:
        doc = _col.find_one({"_id": sid})
        if not doc:
            return _err("Snapshot introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_snapshot")
        return _err("Erreur base de données", 500)


@rig_status_snapshots_bp.route("/api/rig-status-snapshots", methods=["POST"])
def create_snapshot():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "rig_id", "project_id", "status"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        if body["status"] not in STATUSES:
            return _err(f"status invalide ({', '.join(STATUSES)})", 400)

        timestamp_raw = body.get("timestamp")
        timestamp = (
            datetime.fromisoformat(timestamp_raw.replace("Z", "+00:00"))
            if timestamp_raw
            else _now()
        )

        doc = {
            "_id": body["_id"].strip(),
            "rig_id": body["rig_id"].strip(),
            "project_id": body["project_id"].strip(),
            "timestamp": timestamp,
            "status": body["status"],
        }
        _col.insert_one(doc)
        return _ok({"snapshot": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_snapshot")
        return _err("Erreur base de données", 500)


@rig_status_snapshots_bp.route("/api/rig-status-snapshots/<sid>", methods=["PUT"])
def update_snapshot(sid):
    try:
        if not _col.find_one({"_id": sid}):
            return _err("Snapshot introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        if "status" in body:
            if body["status"] not in STATUSES:
                return _err("status invalide", 400)
            upd["status"] = body["status"]

        if "timestamp" in body and body["timestamp"]:
            upd["timestamp"] = datetime.fromisoformat(body["timestamp"].replace("Z", "+00:00"))

        for field in ("rig_id", "project_id"):
            if field in body and body[field]:
                upd[field] = body[field].strip()

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": sid}, {"$set": upd})
        return _ok({"snapshot": _ser(_col.find_one({"_id": sid}))})
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_snapshot sid=%s", sid)
        return _err("Erreur base de données", 500)


@rig_status_snapshots_bp.route("/api/rig-status-snapshots/<sid>", methods=["DELETE"])
def delete_snapshot(sid):
    try:
        result = _col.delete_one({"_id": sid})
        if result.deleted_count == 0:
            return _err("Snapshot introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_snapshot sid=%s", sid)
        return _err("Erreur base de données", 500)
