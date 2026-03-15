import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
annotation_audits_bp = Blueprint("annotation_audits", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["annotation_audits"]

AUDIT_RESULTS = ("pass", "fail", "warning", None)


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


@annotation_audits_bp.route("/api/annotation-audits", methods=["GET"])
def list_annotation_audits():
    try:
        query = {}
        for param in ("project_id", "run_id", "video_id", "annotator_id", "auditor_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        result_filter = request.args.get("audit_result")
        if result_filter:
            query["audit_result"] = result_filter

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_annotation_audits")
        return _err("Erreur base de données", 500)


@annotation_audits_bp.route("/api/annotation-audits/<aid>", methods=["GET"])
def get_annotation_audit(aid):
    try:
        doc = _col.find_one({"_id": aid})
        if not doc:
            return _err("Audit introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_annotation_audit")
        return _err("Erreur base de données", 500)


@annotation_audits_bp.route("/api/annotation-audits", methods=["POST"])
def create_annotation_audit():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "project_id", "run_id", "video_id", "sequence_id", "annotator_id", "audit_hour_bucket"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        audit_result = body.get("audit_result")
        if audit_result not in AUDIT_RESULTS:
            return _err("audit_result invalide (pass|fail|warning|null)", 400)

        doc = {
            "_id": body["_id"].strip(),
            "project_id": body["project_id"].strip(),
            "run_id": body["run_id"].strip(),
            "video_id": body["video_id"].strip(),
            "sequence_id": body["sequence_id"].strip(),
            "annotator_id": body["annotator_id"].strip(),
            "auditor_id": body.get("auditor_id"),
            "audit_hour_bucket": datetime.fromisoformat(body["audit_hour_bucket"].replace("Z", "+00:00")),
            "annotation_metrics": body.get("annotation_metrics", {}),
            "audit_result": audit_result,
            "issues": body.get("issues", []),
            "created_at": _now(),
        }
        _col.insert_one(doc)
        return _ok({"audit": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_annotation_audit")
        return _err("Erreur base de données", 500)


@annotation_audits_bp.route("/api/annotation-audits/<aid>", methods=["PUT"])
def update_annotation_audit(aid):
    try:
        if not _col.find_one({"_id": aid}):
            return _err("Audit introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        if "audit_result" in body:
            if body["audit_result"] not in AUDIT_RESULTS:
                return _err("audit_result invalide", 400)
            upd["audit_result"] = body["audit_result"]

        for field in ("annotation_metrics", "issues", "auditor_id"):
            if field in body:
                upd[field] = body[field]

        if "audit_hour_bucket" in body and body["audit_hour_bucket"]:
            upd["audit_hour_bucket"] = datetime.fromisoformat(
                body["audit_hour_bucket"].replace("Z", "+00:00")
            )

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": aid}, {"$set": upd})
        return _ok({"audit": _ser(_col.find_one({"_id": aid}))})
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_annotation_audit aid=%s", aid)
        return _err("Erreur base de données", 500)


@annotation_audits_bp.route("/api/annotation-audits/<aid>", methods=["DELETE"])
def delete_annotation_audit(aid):
    try:
        result = _col.delete_one({"_id": aid})
        if result.deleted_count == 0:
            return _err("Audit introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_annotation_audit aid=%s", aid)
        return _err("Erreur base de données", 500)
