"""
Operators (physical_data) — nouveau schéma avec full_name, role, employee_code, etc.
Route : /api/operators
"""
import logging
from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
operators_bp = Blueprint("operators", __name__)

DB_NAME = "physical_data"

ROLES = ["capture_operator", "annotator", "auditor", "qa", "supervisor", "other"]
STATUSES = ["active", "inactive", "left"]


def _get_col():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]["operators"]


def _ser(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, ObjectId):
            out[k] = str(v)
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


@operators_bp.route("/api/operators", methods=["GET"])
def list_operators():
    col = _get_col()
    query = {}
    for param in ["role", "site_id", "status"]:
        v = request.args.get(param)
        if v:
            query[param] = v

    limit = min(int(request.args.get("limit", 500)), 1000)
    skip = int(request.args.get("skip", 0))

    # Filtre pour les opérateurs du nouveau schéma (ont un champ full_name)
    query["full_name"] = {"$exists": True}

    docs = list(col.find(query).sort("full_name", 1).skip(skip).limit(limit))
    total = col.count_documents(query)
    return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200


@operators_bp.route("/api/operators/<rid>", methods=["GET"])
def get_operator(rid):
    col = _get_col()
    doc = col.find_one({"_id": rid})
    if not doc:
        return _err("Opérateur introuvable", 404)
    return jsonify(_ser(doc)), 200


@operators_bp.route("/api/operators", methods=["POST"])
def create_operator():
    col = _get_col()
    body = request.get_json() or {}
    required = ["_id", "full_name", "role", "site_id", "status"]
    for f in required:
        if not body.get(f):
            return _err(f"Champ requis : {f}")
    if body["role"] not in ROLES:
        return _err(f"role invalide. Valeurs : {ROLES}")
    if body["status"] not in STATUSES:
        return _err(f"status invalide. Valeurs : {STATUSES}")

    doc = {
        "_id": body["_id"],
        "employee_code": body.get("employee_code") or None,
        "full_name": body["full_name"],
        "role": body["role"],
        "site_id": body["site_id"],
        "skills": body.get("skills") or [],
        "hire_date": None,
        "autonomous_at": None,
        "status": body["status"],
        "cost_profile": body.get("cost_profile") or {},
    }
    try:
        col.insert_one(doc)
    except DuplicateKeyError:
        return _err("Un opérateur avec cet ID existe déjà", 409)
    except PyMongoError as e:
        logger.exception("MongoDB error on create_operator")
        return _err(str(e))
    return _ok({"operator": _ser(doc)}, 201)


@operators_bp.route("/api/operators/<rid>", methods=["PUT"])
def update_operator(rid):
    col = _get_col()
    body = request.get_json() or {}
    upd = {}
    for field in ["full_name", "role", "site_id", "status", "employee_code", "skills", "cost_profile"]:
        if field in body:
            upd[field] = body[field]
    if "role" in upd and upd["role"] not in ROLES:
        return _err(f"role invalide. Valeurs : {ROLES}")
    if "status" in upd and upd["status"] not in STATUSES:
        return _err(f"status invalide. Valeurs : {STATUSES}")
    if not upd:
        return _err("Aucun champ à mettre à jour")
    try:
        res = col.update_one({"_id": rid}, {"$set": upd})
    except PyMongoError as e:
        logger.exception("MongoDB error on update_operator")
        return _err(str(e))
    if res.matched_count == 0:
        return _err("Opérateur introuvable", 404)
    doc = col.find_one({"_id": rid})
    return _ok({"operator": _ser(doc)})


@operators_bp.route("/api/operators/<rid>", methods=["DELETE"])
def delete_operator(rid):
    col = _get_col()
    result = col.delete_one({"_id": rid})
    if result.deleted_count == 0:
        return _err("Opérateur introuvable", 404)
    return _ok({"deleted": True})
