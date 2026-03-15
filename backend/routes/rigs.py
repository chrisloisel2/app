import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
rigs_bp = Blueprint("rigs", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["rigs"]


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


@rigs_bp.route("/api/rigs", methods=["GET"])
def list_rigs():
    try:
        site_id = request.args.get("site_id")
        status = request.args.get("status")
        query = {}
        if site_id:
            query["site_id"] = site_id
        if status:
            query["status"] = status
        docs = list(_col.find(query).sort("code", 1))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("list_rigs")
        return _err("Erreur base de données", 500)


@rigs_bp.route("/api/rigs/<rid>", methods=["GET"])
def get_rig(rid):
    try:
        doc = _col.find_one({"_id": rid})
        if not doc:
            return _err("Rig introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_rig")
        return _err("Erreur base de données", 500)


@rigs_bp.route("/api/rigs", methods=["POST"])
def create_rig():
    try:
        body = request.get_json(silent=True) or {}
        rid = (body.get("_id") or "").strip()
        code = (body.get("code") or "").strip()
        site_id = (body.get("site_id") or "").strip()
        status = body.get("status", "active")

        if not rid or not code or not site_id:
            return _err("_id, code et site_id sont requis", 400)
        if status not in ("active", "inactive", "maintenance", "retired"):
            return _err("status invalide (active|inactive|maintenance|retired)", 400)

        doc = {
            "_id": rid,
            "code": code,
            "site_id": site_id,
            "project_ids": body.get("project_ids", []),
            "status": status,
            "commissioned_at": None,
            "specs": body.get("specs", {}),
        }
        _col.insert_one(doc)
        return _ok({"rig": _ser(_col.find_one({"_id": rid}))}, 201)
    except DuplicateKeyError:
        return _err("Un rig avec cet identifiant ou ce code existe déjà", 409)
    except PyMongoError:
        logger.exception("create_rig")
        return _err("Erreur base de données", 500)


@rigs_bp.route("/api/rigs/<rid>", methods=["PUT"])
def update_rig(rid):
    try:
        if not _col.find_one({"_id": rid}):
            return _err("Rig introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("code", "site_id"):
            if field in body and (body[field] or "").strip():
                upd[field] = body[field].strip()

        if "status" in body:
            if body["status"] not in ("active", "inactive", "maintenance", "retired"):
                return _err("status invalide", 400)
            upd["status"] = body["status"]

        if "project_ids" in body:
            upd["project_ids"] = body["project_ids"]
        if "specs" in body:
            upd["specs"] = body["specs"]

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": rid}, {"$set": upd})
        return _ok({"rig": _ser(_col.find_one({"_id": rid}))})
    except DuplicateKeyError:
        return _err("Ce code est déjà utilisé", 409)
    except PyMongoError:
        logger.exception("update_rig rid=%s", rid)
        return _err("Erreur base de données", 500)


@rigs_bp.route("/api/rigs/<rid>", methods=["DELETE"])
def delete_rig(rid):
    try:
        result = _col.delete_one({"_id": rid})
        if result.deleted_count == 0:
            return _err("Rig introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_rig rid=%s", rid)
        return _err("Erreur base de données", 500)
