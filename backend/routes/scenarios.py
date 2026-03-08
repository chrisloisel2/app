import os
import logging
from datetime import datetime

from bson import ObjectId
from flask import Blueprint, jsonify, request
from pymongo import MongoClient

logger = logging.getLogger(__name__)

scenarios_bp = Blueprint("scenarios", __name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:admin123@192.168.88.17:27017/")
DB_NAME     = "physical_data"

_mongo = MongoClient(MONGODB_URI)
_db    = _mongo[DB_NAME]
_col   = _db["scenarios"]


def _ser(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@scenarios_bp.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    docs = list(_col.find({}, {"__v": 0}).sort("created_at", -1))
    return jsonify([_ser(d) for d in docs])


@scenarios_bp.route("/api/scenarios/<sid>", methods=["GET"])
def get_scenario(sid):
    try:
        oid = ObjectId(sid)
    except Exception:
        return jsonify({"error": "id invalide"}), 400
    doc = _col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "scénario introuvable"}), 404
    return jsonify(_ser(doc))


@scenarios_bp.route("/api/scenarios", methods=["POST"])
def create_scenario():
    body = request.get_json(silent=True) or {}
    nom = (body.get("nom") or "").strip()
    if not nom:
        return jsonify({"error": "Le champ 'nom' est requis"}), 400

    if _col.find_one({"nom": nom}):
        return jsonify({"error": "Un scénario avec ce nom existe déjà"}), 409

    now = datetime.utcnow().isoformat()
    doc = {
        "nom":         nom,
        "description": (body.get("description") or "").strip(),
        "duree_min":   int(body.get("duree_min") or 0),
        "actif":       bool(body.get("actif", True)),
        "created_at":  now,
        "updated_at":  now,
    }
    result = _col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return jsonify({"inserted_id": doc["_id"]}), 201


@scenarios_bp.route("/api/scenarios/<sid>", methods=["PUT"])
def update_scenario(sid):
    try:
        oid = ObjectId(sid)
    except Exception:
        return jsonify({"error": "id invalide"}), 400

    if not _col.find_one({"_id": oid}):
        return jsonify({"error": "scénario introuvable"}), 404

    body   = request.get_json(silent=True) or {}
    update = {"updated_at": datetime.utcnow().isoformat()}

    if "nom" in body and body["nom"].strip():
        existing = _col.find_one({"nom": body["nom"].strip(), "_id": {"$ne": oid}})
        if existing:
            return jsonify({"error": "Ce nom est déjà utilisé par un autre scénario"}), 409
        update["nom"] = body["nom"].strip()

    if "description" in body:
        update["description"] = (body["description"] or "").strip()
    if "duree_min" in body:
        update["duree_min"] = int(body["duree_min"] or 0)
    if "actif" in body:
        update["actif"] = bool(body["actif"])

    _col.update_one({"_id": oid}, {"$set": update})
    return jsonify({"updated": True})


@scenarios_bp.route("/api/scenarios/<sid>", methods=["DELETE"])
def delete_scenario(sid):
    try:
        oid = ObjectId(sid)
    except Exception:
        return jsonify({"error": "id invalide"}), 400

    doc = _col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "scénario introuvable"}), 404

    _col.delete_one({"_id": oid})
    return jsonify({"deleted": True})
