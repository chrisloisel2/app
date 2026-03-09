"""
SSH Parc — gestion des connexions SSH du parc PC.
Collection MongoDB : orchestrator_ssh
"""

from flask import Blueprint, jsonify, request
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
from config import MONGODB_URI
import datetime

ssh_parc_bp = Blueprint("ssh_parc", __name__)


def get_col():
    client = MongoClient(MONGODB_URI)
    return client["physical_data"]["orchestrator_ssh"]


@ssh_parc_bp.get("/api/ssh-parc")
def list_ssh():
    """Retourne la liste des PCs enregistrés (dernier document par hostname)."""
    col = get_col()
    # Déduplique par hostname — garde le plus récent
    pipeline = [
        {"$sort": {"timestamp": DESCENDING}},
        {"$group": {
            "_id": "$hostname",
            "doc": {"$first": "$$ROOT"},
        }},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$sort": {"hostname": 1}},
    ]
    docs = list(col.aggregate(pipeline))
    for d in docs:
        d["_id"] = str(d["_id"])
        if isinstance(d.get("timestamp"), datetime.datetime):
            d["timestamp"] = d["timestamp"].isoformat()
    return jsonify(docs)


@ssh_parc_bp.delete("/api/ssh-parc/<id>")
def delete_ssh(id):
    """Supprime une entrée SSH par son _id."""
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400
    col = get_col()
    result = col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"error": "Entrée introuvable"}), 404
    return jsonify({"deleted": True})


@ssh_parc_bp.delete("/api/ssh-parc")
def clear_ssh():
    """Supprime toutes les entrées SSH."""
    col = get_col()
    result = col.delete_many({})
    return jsonify({"deleted": result.deleted_count})
