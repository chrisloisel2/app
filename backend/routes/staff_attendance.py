import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
staff_attendance_bp = Blueprint("staff_attendance", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["staff_attendance"]


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


@staff_attendance_bp.route("/api/staff-attendance", methods=["GET"])
def list_attendance():
    try:
        query = {}
        for param in ("project_id", "site_id", "shift_id", "operator_id", "date"):
            val = request.args.get(param)
            if val:
                query[param] = val
        present = request.args.get("present")
        if present is not None:
            query["present"] = present.lower() == "true"

        limit = min(int(request.args.get("limit", 200)), 1000)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort([("date", -1), ("operator_id", 1)]).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_attendance")
        return _err("Erreur base de données", 500)


@staff_attendance_bp.route("/api/staff-attendance/<aid>", methods=["GET"])
def get_attendance(aid):
    try:
        doc = _col.find_one({"_id": aid})
        if not doc:
            return _err("Présence introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_attendance")
        return _err("Erreur base de données", 500)


@staff_attendance_bp.route("/api/staff-attendance", methods=["POST"])
def create_attendance():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "date", "shift_id", "site_id", "project_id", "operator_id", "role"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        doc = {
            "_id": body["_id"].strip(),
            "date": body["date"].strip(),
            "shift_id": body["shift_id"].strip(),
            "site_id": body["site_id"].strip(),
            "project_id": body["project_id"].strip(),
            "operator_id": body["operator_id"].strip(),
            "scheduled": bool(body.get("scheduled", True)),
            "present": bool(body.get("present", False)),
            "hours": body.get("hours", {}),
            "role": body["role"].strip(),
            "autonomous": body.get("autonomous"),
        }
        _col.insert_one(doc)
        return _ok({"attendance": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except DuplicateKeyError:
        return _err("Un enregistrement de présence existe déjà pour ce shift/opérateur", 409)
    except PyMongoError:
        logger.exception("create_attendance")
        return _err("Erreur base de données", 500)


@staff_attendance_bp.route("/api/staff-attendance/<aid>", methods=["PUT"])
def update_attendance(aid):
    try:
        if not _col.find_one({"_id": aid}):
            return _err("Présence introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("scheduled", "present", "autonomous", "role"):
            if field in body:
                upd[field] = body[field]
        if "hours" in body:
            upd["hours"] = body["hours"]

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": aid}, {"$set": upd})
        return _ok({"attendance": _ser(_col.find_one({"_id": aid}))})
    except PyMongoError:
        logger.exception("update_attendance aid=%s", aid)
        return _err("Erreur base de données", 500)


@staff_attendance_bp.route("/api/staff-attendance/<aid>", methods=["DELETE"])
def delete_attendance(aid):
    try:
        result = _col.delete_one({"_id": aid})
        if result.deleted_count == 0:
            return _err("Présence introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_attendance aid=%s", aid)
        return _err("Erreur base de données", 500)
