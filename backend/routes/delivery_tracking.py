import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
delivery_tracking_bp = Blueprint("delivery_tracking", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["delivery_tracking"]


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


@delivery_tracking_bp.route("/api/delivery-tracking", methods=["GET"])
def list_delivery():
    try:
        query = {}
        for param in ("project_id", "run_id", "video_id", "shift_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        upload_status = request.args.get("upload_status")
        if upload_status:
            query["upload.status"] = upload_status
        delivery_status = request.args.get("delivery_status")
        if delivery_status:
            query["delivery.status"] = delivery_status

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("_id", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_delivery")
        return _err("Erreur base de données", 500)


@delivery_tracking_bp.route("/api/delivery-tracking/<did>", methods=["GET"])
def get_delivery(did):
    try:
        doc = _col.find_one({"_id": did})
        if not doc:
            return _err("Livraison introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_delivery")
        return _err("Erreur base de données", 500)


@delivery_tracking_bp.route("/api/delivery-tracking", methods=["POST"])
def create_delivery():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "project_id", "run_id", "video_id", "shift_id"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        doc = {
            "_id": body["_id"].strip(),
            "project_id": body["project_id"].strip(),
            "run_id": body["run_id"].strip(),
            "video_id": body["video_id"].strip(),
            "shift_id": body["shift_id"].strip(),
            "upload": body.get("upload", {"status": "pending"}),
            "delivery": body.get("delivery", {"status": "pending"}),
            "dataset_integrity": body.get("dataset_integrity", {}),
            "queues": body.get("queues", {}),
        }
        _col.insert_one(doc)
        return _ok({"delivery": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except DuplicateKeyError:
        return _err("Un enregistrement de livraison pour ce run existe déjà", 409)
    except PyMongoError:
        logger.exception("create_delivery")
        return _err("Erreur base de données", 500)


@delivery_tracking_bp.route("/api/delivery-tracking/<did>", methods=["PUT"])
def update_delivery(did):
    try:
        if not _col.find_one({"_id": did}):
            return _err("Livraison introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("upload", "delivery", "dataset_integrity", "queues"):
            if field in body:
                upd[field] = body[field]

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": did}, {"$set": upd})
        return _ok({"delivery": _ser(_col.find_one({"_id": did}))})
    except PyMongoError:
        logger.exception("update_delivery did=%s", did)
        return _err("Erreur base de données", 500)


@delivery_tracking_bp.route("/api/delivery-tracking/<did>", methods=["DELETE"])
def delete_delivery(did):
    try:
        result = _col.delete_one({"_id": did})
        if result.deleted_count == 0:
            return _err("Livraison introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_delivery did=%s", did)
        return _err("Erreur base de données", 500)
