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


def _parse_duree(value) -> int:
    """Convertit n'importe quelle valeur raisonnable en int, retourne 0 si invalide."""
    if value is None or value == "":
        return 0
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        raise ValueError(f"'duree_min' invalide : {value!r}")


def _parse_actif(value, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "on")
    return default


@scenarios_bp.route("/api/scenarios", methods=["POST"])
def create_scenario():
    try:
        body = request.get_json(silent=True) or {}
        logger.debug("POST /api/scenarios payload=%s", body)

        nom = str(body.get("nom") or "").strip()
        if not nom:
            return jsonify({"error": "Le champ 'nom' est requis"}), 400

        if _col.find_one({"nom": nom}):
            return jsonify({"error": "Un scénario avec ce nom existe déjà"}), 409

        try:
            duree_min = _parse_duree(body.get("duree_min"))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        now = datetime.utcnow().isoformat()
        doc = {
            "nom":         nom,
            "description": str(body.get("description") or "").strip(),
            "duree_min":   duree_min,
            "actif":       _parse_actif(body.get("actif", True)),
            "created_at":  now,
            "updated_at":  now,
        }
        result = _col.insert_one(doc)
        return jsonify({"inserted_id": str(result.inserted_id)}), 201

    except Exception:
        logger.exception("Erreur create_scenario")
        return jsonify({"error": "Erreur interne serveur"}), 500


@scenarios_bp.route("/api/scenarios/<sid>", methods=["PUT"])
def update_scenario(sid):
    try:
        oid = ObjectId(sid)
    except Exception:
        return jsonify({"error": "id invalide"}), 400

    if not _col.find_one({"_id": oid}):
        return jsonify({"error": "scénario introuvable"}), 404

    try:
        body   = request.get_json(silent=True) or {}
        update = {"updated_at": datetime.utcnow().isoformat()}

        if "nom" in body:
            nom = str(body["nom"] or "").strip()
            if nom:
                existing = _col.find_one({"nom": nom, "_id": {"$ne": oid}})
                if existing:
                    return jsonify({"error": "Ce nom est déjà utilisé par un autre scénario"}), 409
                update["nom"] = nom

        if "description" in body:
            update["description"] = str(body["description"] or "").strip()

        if "duree_min" in body:
            try:
                update["duree_min"] = _parse_duree(body["duree_min"])
            except ValueError as e:
                return jsonify({"error": str(e)}), 400

        if "actif" in body:
            update["actif"] = _parse_actif(body["actif"])

        _col.update_one({"_id": oid}, {"$set": update})
        return jsonify({"updated": True})

    except Exception:
        logger.exception("Erreur update_scenario")
        return jsonify({"error": "Erreur interne serveur"}), 500


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
