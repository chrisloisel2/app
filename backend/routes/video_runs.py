import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
video_runs_bp = Blueprint("video_runs", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["video_runs"]

QA_STATUSES = ("pending", "accepted", "rejected", "rework", None)
ANN_STATUSES = ("pending", "in_progress", "completed", "failed", None)
UPL_STATUSES = ("pending", "success", "failed", None)
DEL_STATUSES = ("pending", "delivered", "failed", None)


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


def _parse_dt(value):
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


@video_runs_bp.route("/api/video-runs", methods=["GET"])
def list_video_runs():
    try:
        query = {}
        for param in ("project_id", "operator_id", "rig_id", "shift_id", "scenario_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        qa = request.args.get("qa_status")
        if qa:
            query["pipeline_status.qa_status"] = qa

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))

        docs = list(_col.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_video_runs")
        return _err("Erreur base de données", 500)


@video_runs_bp.route("/api/video-runs/<run_id>", methods=["GET"])
def get_video_run(run_id):
    try:
        doc = _col.find_one({"_id": run_id})
        if not doc:
            return _err("Run introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_video_run")
        return _err("Erreur base de données", 500)


@video_runs_bp.route("/api/video-runs", methods=["POST"])
def create_video_run():
    try:
        body = request.get_json(silent=True) or {}
        run_id = (body.get("_id") or "").strip()
        for required in ("_id", "project_id", "site_id", "shift_id", "rig_id", "operator_id"):
            if not (body.get(required) or "").strip():
                return _err(f"{required} est requis", 400)

        video = body.get("video", {})
        if not video.get("video_id") or not video.get("storage_path") or video.get("raw_duration_sec") is None:
            return _err("video.video_id, video.storage_path et video.raw_duration_sec sont requis", 400)

        now = _now()
        doc = {
            "_id": run_id,
            "project_id": body["project_id"].strip(),
            "site_id": body["site_id"].strip(),
            "scenario_id": body.get("scenario_id"),
            "shift_id": body["shift_id"].strip(),
            "rig_id": body["rig_id"].strip(),
            "operator_id": body["operator_id"].strip(),
            "video": video,
            "timing": body.get("timing", {}),
            "durations": body.get("durations", {}),
            "quality_flags": body.get("quality_flags", {}),
            "pipeline_status": body.get("pipeline_status", {
                "ingested": False,
                "qa_status": "pending",
                "annotation_status": "pending",
                "upload_status": "pending",
                "delivery_status": "pending",
                "rework_required": False,
            }),
            "metrics": body.get("metrics", {}),
            "created_at": now,
            "updated_at": now,
        }
        _col.insert_one(doc)
        return _ok({"run": _ser(_col.find_one({"_id": run_id}))}, 201)
    except DuplicateKeyError:
        return _err("Un run avec cet identifiant ou ce video_id existe déjà", 409)
    except PyMongoError:
        logger.exception("create_video_run")
        return _err("Erreur base de données", 500)


@video_runs_bp.route("/api/video-runs/<run_id>", methods=["PUT"])
def update_video_run(run_id):
    try:
        if not _col.find_one({"_id": run_id}):
            return _err("Run introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {"updated_at": _now()}

        for field in ("scenario_id", "operator_id", "rig_id", "shift_id"):
            if field in body:
                upd[field] = body[field]

        for nested in ("video", "timing", "durations", "quality_flags", "pipeline_status", "metrics"):
            if nested in body:
                upd[nested] = body[nested]

        _col.update_one({"_id": run_id}, {"$set": upd})
        return _ok({"run": _ser(_col.find_one({"_id": run_id}))})
    except PyMongoError:
        logger.exception("update_video_run run_id=%s", run_id)
        return _err("Erreur base de données", 500)


@video_runs_bp.route("/api/video-runs/<run_id>", methods=["DELETE"])
def delete_video_run(run_id):
    try:
        result = _col.delete_one({"_id": run_id})
        if result.deleted_count == 0:
            return _err("Run introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_video_run run_id=%s", run_id)
        return _err("Erreur base de données", 500)
