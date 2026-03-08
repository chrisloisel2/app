import os
import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

logger = logging.getLogger(__name__)

scenarios_bp = Blueprint("scenarios", __name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://admin:admin123@192.168.88.17:27017/")
DB_NAME     = os.getenv("DB_NAME", "physical_data")

_mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
_db    = _mongo[DB_NAME]
_col   = _db["scenarios"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ok(data=None, status=200):
    payload = {"ok": True}
    if data:
        payload.update(data)
    return jsonify(payload), status


def _err(message, status=400):
    return jsonify({"ok": False, "error": message}), status


def _now():
    return datetime.now(timezone.utc).isoformat()


def _ser(doc):
    return {k: str(v) if isinstance(v, ObjectId) else v for k, v in doc.items()}


def _body():
    data = request.get_json(silent=True)
    if data is None:
        raw = request.get_data(as_text=True)
        logger.warning("BODY NON JSON — raw=%r content_type=%r", raw, request.content_type)
        if raw and raw.strip():
            raise ValueError("Corps de requête JSON invalide ou Content-Type manquant")
        return {}
    if not isinstance(data, dict):
        raise ValueError("Le corps JSON doit être un objet")
    return data


def _parse_duree(value) -> int:
    if value is None or value == "":
        return 0
    if isinstance(value, bool):
        raise ValueError("duree_min invalide")
    if isinstance(value, int):
        n = value
    elif isinstance(value, float):
        n = int(value)
    else:
        try:
            n = int(float(str(value).strip().replace(",", ".")))
        except Exception:
            raise ValueError(f"duree_min invalide : {value!r}")
    if n < 0:
        raise ValueError("duree_min doit être >= 0")
    if n > 1440:
        raise ValueError("duree_min ne peut pas dépasser 1440 min (24 h)")
    return n


def _parse_bool(value, default=True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    s = str(value).strip().lower()
    if s in ("true", "1", "yes", "on", "oui"):
        return True
    if s in ("false", "0", "no", "off", "non"):
        return False
    return default


# ── Routes ────────────────────────────────────────────────────────────────────

@scenarios_bp.route("/api/scenarios/_ping", methods=["GET"])
def ping_scenarios():
    logger.warning("PING /api/scenarios/_ping atteint")
    return _ok({"service": "scenarios", "collection": _col.full_name})


@scenarios_bp.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    logger.warning("GET /api/scenarios atteint")
    try:
        docs = list(_col.find({}).sort("created_at", -1))
        return jsonify([_ser(d) for d in docs]), 200
    except Exception:
        logger.exception("ECHEC list_scenarios")
        return _err("Erreur base de données", 500)


@scenarios_bp.route("/api/scenarios", methods=["POST"])
def create_scenario():
    logger.warning("ENTER create_scenario")
    try:
        body = _body()
        logger.warning("POST /api/scenarios payload=%r", body)

        nom = str(body.get("nom") or "").strip()
        if not nom:
            return _err("Le champ 'nom' est requis", 400)

        description = str(body.get("description") or "").strip()
        duree_min   = _parse_duree(body.get("duree_min", body.get("duree_estimee")))
        actif       = _parse_bool(body.get("actif", True))

        now = _now()
        doc = {
            "nom":         nom,
            "description": description,
            "duree_min":   duree_min,
            "actif":       actif,
            "created_at":  now,
            "updated_at":  now,
        }

        result  = _col.insert_one(doc)
        inserted = _col.find_one({"_id": result.inserted_id})
        logger.warning("SCENARIO INSERE id=%s", result.inserted_id)
        return _ok({"scenario": _ser(inserted)}, 201)

    except DuplicateKeyError:
        logger.exception("DUPLICATE create_scenario")
        return _err("Un scénario avec ce nom existe déjà", 409)
    except ValueError as e:
        logger.exception("VALUE ERROR create_scenario")
        return _err(str(e), 400)
    except PyMongoError:
        logger.exception("PYMONGO ERROR create_scenario")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("UNHANDLED create_scenario")
        return _err("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["GET"])
def get_scenario(sid):
    logger.warning("GET /api/scenarios/%s atteint", sid)
    try:
        oid = ObjectId(sid)
        doc = _col.find_one({"_id": oid})
        if not doc:
            return _err("scénario introuvable", 404)
        return jsonify(_ser(doc)), 200
    except (InvalidId, Exception) as e:
        if isinstance(e, InvalidId):
            return _err("id invalide", 400)
        logger.exception("ECHEC get_scenario sid=%s", sid)
        return _err("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["PUT"])
def update_scenario(sid):
    logger.warning("ENTER update_scenario sid=%s", sid)
    try:
        oid  = ObjectId(sid)
        body = _body()
        logger.warning("PUT /api/scenarios/%s payload=%r", sid, body)

        current = _col.find_one({"_id": oid})
        if not current:
            return _err("scénario introuvable", 404)

        update = {"updated_at": _now()}

        if "nom" in body:
            nom = str(body.get("nom") or "").strip()
            if nom:
                update["nom"] = nom

        if "description" in body:
            update["description"] = str(body.get("description") or "").strip()

        if "duree_min" in body or "duree_estimee" in body:
            update["duree_min"] = _parse_duree(
                body.get("duree_min", body.get("duree_estimee"))
            )

        if "actif" in body:
            update["actif"] = _parse_bool(body.get("actif"), current.get("actif", True))

        _col.update_one({"_id": oid}, {"$set": update})
        updated = _col.find_one({"_id": oid})
        logger.warning("SCENARIO MIS A JOUR sid=%s", sid)
        return _ok({"scenario": _ser(updated)})

    except InvalidId:
        return _err("id invalide", 400)
    except DuplicateKeyError:
        logger.exception("DUPLICATE update_scenario")
        return _err("Ce nom est déjà utilisé par un autre scénario", 409)
    except ValueError as e:
        logger.exception("VALUE ERROR update_scenario")
        return _err(str(e), 400)
    except PyMongoError:
        logger.exception("PYMONGO ERROR update_scenario")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("UNHANDLED update_scenario")
        return _err("Erreur interne serveur", 500)


@scenarios_bp.route("/api/scenarios/<sid>", methods=["DELETE"])
def delete_scenario(sid):
    logger.warning("ENTER delete_scenario sid=%s", sid)
    try:
        oid    = ObjectId(sid)
        result = _col.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return _err("scénario introuvable", 404)
        logger.warning("SCENARIO SUPPRIME sid=%s", sid)
        return _ok({"deleted": True})
    except InvalidId:
        return _err("id invalide", 400)
    except PyMongoError:
        logger.exception("PYMONGO ERROR delete_scenario")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("UNHANDLED delete_scenario")
        return _err("Erreur interne serveur", 500)
