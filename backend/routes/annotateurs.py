from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from bson import ObjectId
from config import MONGODB_URI

annotateurs_bp = Blueprint("annotateurs", __name__)

def get_col():
    client = MongoClient(MONGODB_URI)
    return client["physical_data"]["annotators"]


@annotateurs_bp.route("/api/annotateurs", methods=["GET"])
def list_annotateurs():
    col  = get_col()
    docs = list(col.find({}, {"password": 0}))
    for d in docs:
        d["_id"] = str(d["_id"])
        d.setdefault("nom_utilisateur", d.get("username", ""))
    return jsonify(docs)


@annotateurs_bp.route("/api/annotateurs", methods=["POST"])
def create_annotateur():
    body = request.get_json(silent=True) or {}
    numero_poste    = body.get("numero_poste", "").strip()
    nom_utilisateur = body.get("nom_utilisateur", "").strip()
    mdp             = body.get("mdp", "").strip()

    if not numero_poste or not nom_utilisateur or not mdp:
        return jsonify({"error": "numero_poste, nom_utilisateur et mdp sont requis"}), 400

    col = get_col()
    if col.find_one({"username": nom_utilisateur}):
        return jsonify({"error": "Ce nom d'utilisateur existe déjà"}), 409

    result = col.insert_one({
        "numero_poste": numero_poste,
        "username":     nom_utilisateur,
        "password":     mdp,
    })
    return jsonify({"_id": str(result.inserted_id)}), 201


@annotateurs_bp.route("/api/annotateurs/<id>", methods=["PUT"])
def update_annotateur(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    body   = request.get_json(silent=True) or {}
    update = {}
    if "numero_poste" in body:
        update["numero_poste"] = body["numero_poste"].strip()
    if "nom_utilisateur" in body and body["nom_utilisateur"].strip():
        update["username"] = body["nom_utilisateur"].strip()
    if "mdp" in body and body["mdp"].strip():
        update["password"] = body["mdp"].strip()

    if not update:
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    col    = get_col()
    result = col.update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        return jsonify({"error": "Annotateur introuvable"}), 404
    return jsonify({"updated": True})


@annotateurs_bp.route("/api/annotateurs/<id>", methods=["DELETE"])
def delete_annotateur(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    col    = get_col()
    result = col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"error": "Annotateur introuvable"}), 404
    return jsonify({"deleted": True})
