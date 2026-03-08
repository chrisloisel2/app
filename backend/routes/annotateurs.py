import logging

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import MONGODB_URI

logger = logging.getLogger(__name__)

annotateurs_bp = Blueprint("annotateurs", __name__)

_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)
_db = _client["physical_data"]
_col = _db["annotators"]

try:
    _col.create_index([("username", ASCENDING)], unique=True, name="uniq_username")
except Exception:
    logger.exception("Impossible de créer l'index unique sur annotators.username")


def _ok(data=None, status=200):
    payload = {"ok": True}
    if data is not None:
        payload.update(data)
    return jsonify(payload), status


def _err(message, status=400, extra=None):
    payload = {"ok": False, "error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status


def _ser(doc: dict) -> dict:
    if not doc:
        return {}
    out = {}
    for k, v in doc.items():
        out[k] = str(v) if isinstance(v, ObjectId) else v
    out.pop("password", None)
    out.setdefault("nom_utilisateur", out.get("username", ""))
    return out


def _body() -> dict:
    data = request.get_json(silent=True)
    if data is None:
        raw = request.get_data(as_text=True)
        logger.warning(
            "Body JSON invalide path=%s content_type=%r raw=%r",
            request.path,
            request.content_type,
            raw,
        )
        if raw and raw.strip():
            raise ValueError("Le corps de requête n'est pas un JSON valide")
        return {}
    if not isinstance(data, dict):
        raise ValueError("Le corps JSON doit être un objet")
    return data


def _s(value, max_len=None) -> str:
    if value is None:
        out = ""
    elif isinstance(value, str):
        out = value.strip()
    else:
        out = str(value).strip()

    if max_len is not None:
        out = out[:max_len]
    return out


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise ValueError("ID invalide")


@annotateurs_bp.route("/api/annotateurs/_ping", methods=["GET"])
def ping_annotateurs():
    logger.warning("PING /api/annotateurs/_ping atteint")
    return _ok({"service": "annotateurs"})


@annotateurs_bp.route("/api/annotateurs", methods=["GET"])
def list_annotateurs():
    logger.warning("GET /api/annotateurs atteint")
    try:
        docs = list(_col.find({}, {"password": 0}).sort("username", 1))
        return jsonify([_ser(d) for d in docs]), 200
    except PyMongoError:
        logger.exception("Erreur Mongo list_annotateurs")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue list_annotateurs")
        return _err("Erreur interne serveur", 500)


@annotateurs_bp.route("/api/annotateurs", methods=["POST"])
def create_annotateur():
    logger.warning("ENTER create_annotateur")
    try:
        body = _body()
        logger.warning("POST /api/annotateurs payload=%r", body)

        numero_poste = _s(body.get("numero_poste"), 100)
        nom_utilisateur = _s(body.get("nom_utilisateur"), 150)
        mdp = _s(body.get("mdp"), 500)

        if not numero_poste or not nom_utilisateur or not mdp:
            return _err("numero_poste, nom_utilisateur et mdp sont requis", 400)

        doc = {
            "numero_poste": numero_poste,
            "username": nom_utilisateur,
            "password": mdp,
        }

        result = _col.insert_one(doc)
        inserted = _col.find_one({"_id": result.inserted_id}, {"password": 0})

        return _ok({"annotateur": _ser(inserted)}, 201)

    except ValueError as e:
        logger.exception("ValueError create_annotateur")
        return _err(str(e), 400)
    except DuplicateKeyError:
        logger.exception("DuplicateKeyError create_annotateur")
        return _err("Ce nom d'utilisateur existe déjà", 409)
    except PyMongoError:
        logger.exception("PyMongoError create_annotateur")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue create_annotateur")
        return _err("Erreur interne serveur", 500)


@annotateurs_bp.route("/api/annotateurs/<id>", methods=["PUT"])
def update_annotateur(id):
    logger.warning("ENTER update_annotateur id=%s", id)
    try:
        oid = _oid(id)
        body = _body()
        logger.warning("PUT /api/annotateurs/%s payload=%r", id, body)

        current = _col.find_one({"_id": oid})
        if not current:
            return _err("Annotateur introuvable", 404)

        update = {}

        if "numero_poste" in body:
            numero_poste = _s(body.get("numero_poste"), 100)
            if numero_poste:
                update["numero_poste"] = numero_poste

        if "nom_utilisateur" in body:
            nom_utilisateur = _s(body.get("nom_utilisateur"), 150)
            if nom_utilisateur:
                update["username"] = nom_utilisateur

        if "mdp" in body:
            mdp = _s(body.get("mdp"), 500)
            if mdp:
                update["password"] = mdp

        if not update:
            return _err("Aucun champ à mettre à jour", 400)

        _col.update_one({"_id": oid}, {"$set": update})
        updated = _col.find_one({"_id": oid}, {"password": 0})

        return _ok({"annotateur": _ser(updated)})

    except ValueError as e:
        logger.exception("ValueError update_annotateur")
        return _err(str(e), 400)
    except DuplicateKeyError:
        logger.exception("DuplicateKeyError update_annotateur")
        return _err("Ce nom d'utilisateur existe déjà", 409)
    except PyMongoError:
        logger.exception("PyMongoError update_annotateur")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue update_annotateur")
        return _err("Erreur interne serveur", 500)


@annotateurs_bp.route("/api/annotateurs/<id>", methods=["DELETE"])
def delete_annotateur(id):
    logger.warning("ENTER delete_annotateur id=%s", id)
    try:
        oid = _oid(id)
        result = _col.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return _err("Annotateur introuvable", 404)
        return _ok({"deleted": True})
    except ValueError as e:
        logger.exception("ValueError delete_annotateur")
        return _err(str(e), 400)
    except PyMongoError:
        logger.exception("PyMongoError delete_annotateur")
        return _err("Erreur base de données", 500)
    except Exception:
        logger.exception("Erreur inattendue delete_annotateur")
        return _err("Erreur interne serveur", 500)
