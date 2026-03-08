import os
import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError

logger = logging.getLogger(__name__)

scenarios_bp = Blueprint("scenarios", __name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:admin123@192.168.88.17:27017/")
DB_NAME = os.getenv("DB_NAME", "physical_data")
COLLECTION_NAME = "scenarios"

_mongo = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)
_db = _mongo[DB_NAME]
_col = _db[COLLECTION_NAME]

# Index unique pour empêcher les doublons de nom.
try:
    _col.create_index([("nom", ASCENDING)], unique=True, name="uniq_nom")
except Exception:
    logger.exception("Impossible de créer l'index unique sur scenarios.nom")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_error(message: str, status: int):
    return jsonify({"error": message}), status


def _serialize_value(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _ser(doc: dict) -> dict:
    if not isinstance(doc, dict):
        return {}
    return {k: _serialize_value(v) for k, v in doc.items()}


def _get_json_body() -> dict:
    """
    Récupère un body JSON de façon sûre.
    Retourne {} si body vide.
    Lève ValueError si le body n'est pas un objet JSON.
    """
    body = request.get_json(silent=True)
    if body is None:
        raw = request.get_data(cache=False, as_text=True)
        if not raw or not raw.strip():
            return {}
        raise ValueError("Corps de requête JSON invalide ou Content-Type incorrect")
    if not isinstance(body, dict):
        raise ValueError("Le corps JSON doit être un objet")
    return body


def _normalize_string(value, max_len: int | None = None) -> str:
    if value is None:
        s = ""
    elif isinstance(value, str):
        s = value.strip()
    else:
        s = str(value).strip()

    if max_len is not None:
        s = s[:max_len]
    return s


def _parse_duree(value) -> int:
    """
    Accepte int, float, string numérique simple.
    Refuse les valeurs absurdes ou non numériques.
    """
    if value is None or value == "":
        return 0

    if isinstance(value, bool):
        raise ValueError("Le champ 'duree_min' doit être un entier")

    if isinstance(value, int):
        n = value
    elif isinstance(value, float):
        if value != value:
            raise ValueError("Le champ 'duree_min' est invalide")
        n = int(value)
    elif isinstance(value, str):
        s = value.strip().replace(",", ".")
        if not s:
            return 0
        try:
            n = int(float(s))
        except ValueError:
            raise ValueError("Le champ 'duree_min' doit être un entier")
    else:
        raise ValueError("Le champ 'duree_min' doit être un entier")

    if n < 0:
        raise ValueError("Le champ 'duree_min' doit être positif ou nul")
    if n > 24 * 60:
        raise ValueError("Le champ 'duree_min' est trop grand")

    return n


def _parse_actif(value, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        s = value.strip().lower()
        if s in {"true", "1", "yes", "on", "oui"}:
            return True
        if s in {"false", "0", "no", "off", "non"}:
            return False
        return default
    return default


def _extract_nom(body: dict, required: bool = False) -> str | None:
    nom = _normalize_string(body.get("nom"), max_len=200)
    if required and not nom:
        raise ValueError("Le champ 'nom' est requis")
    return nom or None


def _extract_description(body: dict) -> str:
    return _normalize_string(body.get("description"), max_len=5000)


def _extract_duree(body: dict) -> int:
    raw = body.get("duree_min", body.get("duree_estimee"))
    return _parse_duree(raw)


def _extract_oid(sid: str) -> ObjectId:
    try:
        return ObjectId(sid)
    except (InvalidId, TypeError):
        raise ValueError("id invalide")


@scenarios_bp.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    try:
        docs = list(_col.find({}, {"__v": 0}).sort("created_at", -1))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("Erreur list_scenarios")
        return _json_error("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue list_scenarios")
        return _json_error("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["GET"])
def get_scenario(sid):
    try:
        oid = _extract_oid(sid)
        doc = _col.find_one({"_id": oid}, {"__v": 0})
        if not doc:
            return _json_error("scénario introuvable", 404)
        return jsonify(_ser(doc)), 200
    except ValueError as e:
        return _json_error(str(e), 400)
    except PyMongoError:
        logger.exception("Erreur get_scenario sid=%s", sid)
        return _json_error("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue get_scenario sid=%s", sid)
        return _json_error("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios", methods=["POST"])
def create_scenario():
    try:
        body = _get_json_body()
        logger.info("POST /api/scenarios payload=%r", body)

        nom = _extract_nom(body, required=True)
        description = _extract_description(body)
        duree_min = _extract_duree(body)
        actif = _parse_actif(body.get("actif"), default=True)

        now = _now_iso()
        doc = {
            "nom": nom,
            "description": description,
            "duree_min": duree_min,
            "actif": actif,
            "created_at": now,
            "updated_at": now,
        }

        result = _col.insert_one(doc)
        inserted = _col.find_one({"_id": result.inserted_id}, {"__v": 0})

        return jsonify({
            "message": "scénario créé",
            "scenario": _ser(inserted) if inserted else {"_id": str(result.inserted_id), **doc},
        }), 201

    except ValueError as e:
        return _json_error(str(e), 400)
    except DuplicateKeyError:
        return _json_error("Un scénario avec ce nom existe déjà", 409)
    except PyMongoError:
        logger.exception("Erreur Mongo create_scenario")
        return _json_error("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue create_scenario")
        return _json_error("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["PUT"])
def update_scenario(sid):
    try:
        oid = _extract_oid(sid)
        body = _get_json_body()
        logger.info("PUT /api/scenarios/%s payload=%r", sid, body)

        existing_doc = _col.find_one({"_id": oid}, {"__v": 0})
        if not existing_doc:
            return _json_error("scénario introuvable", 404)

        update = {"updated_at": _now_iso()}

        if "nom" in body:
            nom = _extract_nom(body, required=False)
            if nom:
                update["nom"] = nom

        if "description" in body:
            update["description"] = _extract_description(body)

        if "duree_min" in body or "duree_estimee" in body:
            update["duree_min"] = _extract_duree(body)

        if "actif" in body:
            update["actif"] = _parse_actif(body.get("actif"), default=existing_doc.get("actif", True))

        if len(update) == 1:
            return jsonify({"updated": False, "message": "aucun champ modifié"}), 200

        _col.update_one({"_id": oid}, {"$set": update})
        updated_doc = _col.find_one({"_id": oid}, {"__v": 0})

        return jsonify({
            "updated": True,
            "scenario": _ser(updated_doc) if updated_doc else None,
        }), 200

    except ValueError as e:
        return _json_error(str(e), 400)
    except DuplicateKeyError:
        return _json_error("Ce nom est déjà utilisé par un autre scénario", 409)
    except PyMongoError:
        logger.exception("Erreur Mongo update_scenario sid=%s", sid)
        return _json_error("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue update_scenario sid=%s", sid)
        return _json_error("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["DELETE"])
def delete_scenario(sid):
    try:
        oid = _extract_oid(sid)
        result = _col.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return _json_error("scénario introuvable", 404)
        return jsonify({"deleted": True}), 200
    except ValueError as e:
        return _json_error(str(e), 400)
    except PyMongoError:
        logger.exception("Erreur Mongo delete_scenario sid=%s", sid)
        return _json_error("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue delete_scenario sid=%s", sid)
        return _json_error("Erreur interne serveur", 500)
