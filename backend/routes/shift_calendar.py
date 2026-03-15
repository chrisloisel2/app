import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
shift_calendar_bp = Blueprint("shift_calendar", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["shift_calendar"]


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


@shift_calendar_bp.route("/api/shift-calendar", methods=["GET"])
def list_shifts():
    try:
        site_id = request.args.get("site_id")
        date = request.args.get("date")
        query = {}
        if site_id:
            query["site_id"] = site_id
        if date:
            query["date"] = date
        docs = list(_col.find(query).sort([("date", -1), ("name", 1)]))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("list_shifts")
        return _err("Erreur base de données", 500)


@shift_calendar_bp.route("/api/shift-calendar/<sid>", methods=["GET"])
def get_shift(sid):
    try:
        doc = _col.find_one({"_id": sid})
        if not doc:
            return _err("Shift introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_shift")
        return _err("Erreur base de données", 500)


@shift_calendar_bp.route("/api/shift-calendar", methods=["POST"])
def create_shift():
    try:
        body = request.get_json(silent=True) or {}
        sid = (body.get("_id") or "").strip()
        date = (body.get("date") or "").strip()
        site_id = (body.get("site_id") or "").strip()
        name = (body.get("name") or "").strip()
        start_at = body.get("start_at")
        end_at = body.get("end_at")

        if not sid or not date or not site_id or not name or not start_at or not end_at:
            return _err("_id, date, site_id, name, start_at et end_at sont requis", 400)

        doc = {
            "_id": sid,
            "date": date,
            "site_id": site_id,
            "name": name,
            "start_at": datetime.fromisoformat(start_at.replace("Z", "+00:00")),
            "end_at": datetime.fromisoformat(end_at.replace("Z", "+00:00")),
        }
        _col.insert_one(doc)
        return _ok({"shift": _ser(_col.find_one({"_id": sid}))}, 201)
    except DuplicateKeyError:
        return _err("Un shift avec cet identifiant existe déjà", 409)
    except (ValueError, KeyError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_shift")
        return _err("Erreur base de données", 500)


@shift_calendar_bp.route("/api/shift-calendar/<sid>", methods=["PUT"])
def update_shift(sid):
    try:
        if not _col.find_one({"_id": sid}):
            return _err("Shift introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        for field in ("date", "site_id", "name"):
            if field in body and (body[field] or "").strip():
                upd[field] = body[field].strip()

        for field in ("start_at", "end_at"):
            if field in body and body[field]:
                upd[field] = datetime.fromisoformat(body[field].replace("Z", "+00:00"))

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": sid}, {"$set": upd})
        return _ok({"shift": _ser(_col.find_one({"_id": sid}))})
    except (ValueError, KeyError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_shift sid=%s", sid)
        return _err("Erreur base de données", 500)


@shift_calendar_bp.route("/api/shift-calendar/<sid>", methods=["DELETE"])
def delete_shift(sid):
    try:
        result = _col.delete_one({"_id": sid})
        if result.deleted_count == 0:
            return _err("Shift introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_shift sid=%s", sid)
        return _err("Erreur base de données", 500)
