import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
project_planning_bp = Blueprint("project_planning", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["project_planning"]


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


@project_planning_bp.route("/api/project-planning", methods=["GET"])
def list_planning():
    try:
        project_id = request.args.get("project_id")
        date = request.args.get("date")
        query = {}
        if project_id:
            query["project_id"] = project_id
        if date:
            query["date"] = date
        docs = list(_col.find(query).sort([("date", -1)]))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("list_planning")
        return _err("Erreur base de données", 500)


@project_planning_bp.route("/api/project-planning/<pid>", methods=["GET"])
def get_planning(pid):
    try:
        doc = _col.find_one({"_id": pid})
        if not doc:
            return _err("Planning introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_planning")
        return _err("Erreur base de données", 500)


@project_planning_bp.route("/api/project-planning", methods=["POST"])
def create_planning():
    try:
        body = request.get_json(silent=True) or {}
        pid = (body.get("_id") or "").strip()
        project_id = (body.get("project_id") or "").strip()
        date = (body.get("date") or "").strip()
        planned_hours = body.get("planned_hours")

        if not pid or not project_id or not date or planned_hours is None:
            return _err("_id, project_id, date et planned_hours sont requis", 400)

        doc = {
            "_id": pid,
            "project_id": project_id,
            "date": date,
            "planned_hours": float(planned_hours),
            "planned_delivery_deadline": None,
            "planned_operators": body.get("planned_operators"),
            "planned_active_rigs": body.get("planned_active_rigs"),
        }

        if body.get("planned_delivery_deadline"):
            doc["planned_delivery_deadline"] = datetime.fromisoformat(
                body["planned_delivery_deadline"].replace("Z", "+00:00")
            )

        _col.insert_one(doc)
        return _ok({"planning": _ser(_col.find_one({"_id": pid}))}, 201)
    except DuplicateKeyError:
        return _err("Un planning avec cet identifiant existe déjà", 409)
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_planning")
        return _err("Erreur base de données", 500)


@project_planning_bp.route("/api/project-planning/<pid>", methods=["PUT"])
def update_planning(pid):
    try:
        if not _col.find_one({"_id": pid}):
            return _err("Planning introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        if "project_id" in body:
            upd["project_id"] = body["project_id"]
        if "date" in body:
            upd["date"] = body["date"]
        if "planned_hours" in body:
            upd["planned_hours"] = float(body["planned_hours"])
        if "planned_operators" in body:
            upd["planned_operators"] = body["planned_operators"]
        if "planned_active_rigs" in body:
            upd["planned_active_rigs"] = body["planned_active_rigs"]
        if "planned_delivery_deadline" in body:
            upd["planned_delivery_deadline"] = (
                datetime.fromisoformat(body["planned_delivery_deadline"].replace("Z", "+00:00"))
                if body["planned_delivery_deadline"]
                else None
            )

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": pid}, {"$set": upd})
        return _ok({"planning": _ser(_col.find_one({"_id": pid}))})
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_planning pid=%s", pid)
        return _err("Erreur base de données", 500)


@project_planning_bp.route("/api/project-planning/<pid>", methods=["DELETE"])
def delete_planning(pid):
    try:
        result = _col.delete_one({"_id": pid})
        if result.deleted_count == 0:
            return _err("Planning introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_planning pid=%s", pid)
        return _err("Erreur base de données", 500)
