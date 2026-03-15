import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)
qa_results_bp = Blueprint("qa_results", __name__)

DB_NAME = "physical_data"
_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_col = _mongo[DB_NAME]["qa_results"]

DECISIONS = ("accepted", "rejected", "rework", "pending")


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


@qa_results_bp.route("/api/qa-results", methods=["GET"])
def list_qa_results():
    try:
        query = {}
        for param in ("project_id", "operator_id", "shift_id", "run_id", "video_id"):
            val = request.args.get(param)
            if val:
                query[param] = val
        decision = request.args.get("final_decision")
        if decision:
            query["final_decision"] = decision

        limit = min(int(request.args.get("limit", 100)), 500)
        skip = int(request.args.get("skip", 0))
        docs = list(_col.find(query).sort("qa_at", -1).skip(skip).limit(limit))
        total = _col.count_documents(query)
        return jsonify({"total": total, "items": [_ser(d) for d in docs]}), 200
    except PyMongoError:
        logger.exception("list_qa_results")
        return _err("Erreur base de données", 500)


@qa_results_bp.route("/api/qa-results/<qid>", methods=["GET"])
def get_qa_result(qid):
    try:
        doc = _col.find_one({"_id": qid})
        if not doc:
            return _err("QA result introuvable", 404)
        return jsonify(_ser(doc)), 200
    except PyMongoError:
        logger.exception("get_qa_result")
        return _err("Erreur base de données", 500)


@qa_results_bp.route("/api/qa-results", methods=["POST"])
def create_qa_result():
    try:
        body = request.get_json(silent=True) or {}
        for required in ("_id", "run_id", "video_id", "project_id", "operator_id", "shift_id", "final_decision"):
            if not body.get(required):
                return _err(f"{required} est requis", 400)

        if body["final_decision"] not in DECISIONS:
            return _err(f"final_decision invalide ({', '.join(DECISIONS)})", 400)

        qa_at_raw = body.get("qa_at")
        qa_at = (
            datetime.fromisoformat(qa_at_raw.replace("Z", "+00:00"))
            if qa_at_raw
            else _now()
        )

        doc = {
            "_id": body["_id"].strip(),
            "run_id": body["run_id"].strip(),
            "video_id": body["video_id"].strip(),
            "project_id": body["project_id"].strip(),
            "operator_id": body["operator_id"].strip(),
            "shift_id": body["shift_id"].strip(),
            "qa_at": qa_at,
            "gate_results": body.get("gate_results", []),
            "final_decision": body["final_decision"],
            "rejection_reason_codes": body.get("rejection_reason_codes", []),
            "requires_rework": body.get("requires_rework"),
            "rework_type": body.get("rework_type"),
            "defects": body.get("defects", {}),
            "accepted_duration_sec": body.get("accepted_duration_sec"),
            "rejected_duration_sec": body.get("rejected_duration_sec"),
        }
        _col.insert_one(doc)
        return _ok({"qa_result": _ser(_col.find_one({"_id": doc["_id"]}))}, 201)
    except DuplicateKeyError:
        return _err("Un QA result pour ce run existe déjà", 409)
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("create_qa_result")
        return _err("Erreur base de données", 500)


@qa_results_bp.route("/api/qa-results/<qid>", methods=["PUT"])
def update_qa_result(qid):
    try:
        if not _col.find_one({"_id": qid}):
            return _err("QA result introuvable", 404)

        body = request.get_json(silent=True) or {}
        upd = {}

        if "final_decision" in body:
            if body["final_decision"] not in DECISIONS:
                return _err("final_decision invalide", 400)
            upd["final_decision"] = body["final_decision"]

        for field in ("gate_results", "rejection_reason_codes", "requires_rework",
                      "rework_type", "defects", "accepted_duration_sec", "rejected_duration_sec"):
            if field in body:
                upd[field] = body[field]

        if "qa_at" in body and body["qa_at"]:
            upd["qa_at"] = datetime.fromisoformat(body["qa_at"].replace("Z", "+00:00"))

        if not upd:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": qid}, {"$set": upd})
        return _ok({"qa_result": _ser(_col.find_one({"_id": qid}))})
    except (ValueError, TypeError) as e:
        return _err(f"Données invalides : {e}", 400)
    except PyMongoError:
        logger.exception("update_qa_result qid=%s", qid)
        return _err("Erreur base de données", 500)


@qa_results_bp.route("/api/qa-results/<qid>", methods=["DELETE"])
def delete_qa_result(qid):
    try:
        result = _col.delete_one({"_id": qid})
        if result.deleted_count == 0:
            return _err("QA result introuvable", 404)
        return _ok({"deleted": True})
    except PyMongoError:
        logger.exception("delete_qa_result qid=%s", qid)
        return _err("Erreur base de données", 500)
