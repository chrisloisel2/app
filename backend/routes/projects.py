import logging
from datetime import datetime, timezone

from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
projects_bp = Blueprint("projects", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["projects"]


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


# ── LIST ──────────────────────────────────────────────────────────────────────
@projects_bp.route("/api/projects", methods=["GET"])
def list_projects():
    try:
        site_id = request.args.get("site_id")
        status = request.args.get("status")
        query = {}
        if site_id:
            query["site_id"] = site_id
        if status:
            query["status"] = status
        docs = list(_col.find(query).sort("created_at", -1))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("list_projects")
        return _err("Erreur base de données", 500)


# ── GET ONE ───────────────────────────────────────────────────────────────────
@projects_bp.route("/api/projects/<pid>", methods=["GET"])
def get_project(pid):
    try:
        doc = _col.find_one({"_id": pid})
        if not doc:
            return _err("Projet introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_project pid=%s", pid)
        return _err("Erreur base de données", 500)


# ── CREATE ────────────────────────────────────────────────────────────────────
@projects_bp.route("/api/projects", methods=["POST"])
def create_project():
    try:
        body = request.get_json(silent=True) or {}
        pid = (body.get("_id") or "").strip()
        code = (body.get("code") or "").strip()
        name = (body.get("name") or "").strip()
        site_id = (body.get("site_id") or "").strip()
        status = body.get("status", "active")

        if not pid or not code or not name or not site_id:
            return _err("_id, code, name et site_id sont requis", 400)
        if status not in ("active", "inactive", "closed"):
            return _err("status invalide (active|inactive|closed)", 400)

        contract = body.get("contract", {})
        rig_capacity = body.get("rig_capacity", {})

        doc = {
            "_id": pid,
            "code": code,
            "name": name,
            "site_id": site_id,
            "status": status,
            "contract": contract,
            "rig_capacity": rig_capacity,
            "created_at": _now(),
        }
        _col.insert_one(doc)
        return _ok({"project": _ser(_col.find_one({"_id": pid}))}, 201)
    except DuplicateKeyError:
        return _err("Un projet avec cet identifiant ou ce code existe déjà", 409)
    except PyMongoError:
        logger.exception("create_project")
        return _err("Erreur base de données", 500)


# ── UPDATE ────────────────────────────────────────────────────────────────────
@projects_bp.route("/api/projects/<pid>", methods=["PUT"])
def update_project(pid):
    try:
        doc = _col.find_one({"_id": pid})
        if not doc:
            return _err("Projet introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("code", "name", "site_id"):
            if field in body and (body[field] or "").strip():
                upd[field] = body[field].strip()

        if "status" in body:
            if body["status"] not in ("active", "inactive", "closed"):
                return _err("status invalide", 400)
            upd["status"] = body["status"]

        if "contract" in body:
            upd["contract"] = body["contract"]
        if "rig_capacity" in body:
            upd["rig_capacity"] = body["rig_capacity"]

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": pid}, {"$set": upd})
        return _ok({"project": _ser(_col.find_one({"_id": pid}))})
    except DuplicateKeyError:
        return _err("Ce code est déjà utilisé", 409)
    except PyMongoError:
        logger.exception("update_project pid=%s", pid)
        return _err("Erreur base de données", 500)


# ── DELETE ────────────────────────────────────────────────────────────────────
@projects_bp.route("/api/projects/<pid>", methods=["DELETE"])
def delete_project(pid):
    try:
        result = _col.delete_one({"_id": pid})
        if result.deleted_count == 0:
            return _err("Projet introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_project pid=%s", pid)
        return _err("Erreur base de données", 500)
