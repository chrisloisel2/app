from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from bson import ObjectId
from config import MONGODB_URI

operateurs_bp = Blueprint("operateurs", __name__)

def get_col():
    client = MongoClient(MONGODB_URI)
    return client["physicaldata"]["operateurs"]


@operateurs_bp.route("/api/operateurs", methods=["GET"])
def list_operateurs():
    col = get_col()
    docs = list(col.find({}, {"password": 0}))
    for d in docs:
        d["_id"] = str(d["_id"])
    return jsonify(docs)


@operateurs_bp.route("/api/operateurs", methods=["POST"])
def create_operateur():
    body = request.get_json(silent=True) or {}
    numero_poste = body.get("numero_poste", "").strip()
    nom_utilisateur = body.get("nom_utilisateur", "").strip()
    mdp = body.get("mdp", "").strip()

    if not numero_poste or not nom_utilisateur or not mdp:
        return jsonify({"error": "numero_poste, nom_utilisateur et mdp sont requis"}), 400

    col = get_col()
    if col.find_one({"nom_utilisateur": nom_utilisateur}):
        return jsonify({"error": "Ce nom d'utilisateur existe déjà"}), 409

    result = col.insert_one({
        "numero_poste": numero_poste,
        "nom_utilisateur": nom_utilisateur,
        "password": mdp,
    })
    return jsonify({"_id": str(result.inserted_id)}), 201


@operateurs_bp.route("/api/operateurs/<id>", methods=["PUT"])
def update_operateur(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    body = request.get_json(silent=True) or {}
    update = {}
    if "numero_poste" in body:
        update["numero_poste"] = body["numero_poste"].strip()
    if "nom_utilisateur" in body:
        update["nom_utilisateur"] = body["nom_utilisateur"].strip()
    if "mdp" in body and body["mdp"].strip():
        update["password"] = body["mdp"].strip()

    if not update:
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    col = get_col()
    result = col.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        return jsonify({"error": "Opérateur introuvable"}), 404
    return jsonify({"updated": True})


@operateurs_bp.route("/api/operateurs/<id>", methods=["DELETE"])
def delete_operateur(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    col = get_col()
    result = col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"error": "Opérateur introuvable"}), 404
    return jsonify({"deleted": True})
