"""
SSH Parc — gestion des connexions SSH du parc PC.
Collection MongoDB : orchestrator_ssh
"""

from flask import Blueprint, jsonify, request, Response, stream_with_context
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
from config import MONGODB_URI
import datetime
import json
import paramiko
import threading
import queue
import time

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


def _exec_on_host(doc, command, result_queue):
    """Exécute une commande SSH sur un host et pousse le résultat dans la queue."""
    hostname = doc.get("hostname") or doc.get("ip") or "?"
    ip       = doc.get("ip")
    username = doc.get("username") or "root"
    port     = int(doc.get("port") or 22)

    if not ip:
        result_queue.put({"hostname": hostname, "ip": None, "stdout": "", "stderr": "Pas d'IP", "exit_code": -1})
        return

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, port=port, username=username, timeout=10,
                    look_for_keys=True, allow_agent=True)
        _, stdout, stderr = ssh.exec_command(command, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace").rstrip()
        err = stderr.read().decode("utf-8", errors="replace").rstrip()
        code = stdout.channel.recv_exit_status()
        result_queue.put({"hostname": hostname, "ip": ip, "stdout": out, "stderr": err, "exit_code": code})
    except Exception as e:
        result_queue.put({"hostname": hostname, "ip": ip, "stdout": "", "stderr": str(e), "exit_code": -1})
    finally:
        ssh.close()


@ssh_parc_bp.post("/api/ssh-parc/exec")
def exec_command():
    """Exécute une commande sur tous les PCs (ou une sélection) via SSH.
    Body JSON : { "command": "...", "hosts": ["ip1", ...] (optionnel) }
    Retourne un stream SSE : une ligne JSON par PC dès que le résultat arrive.
    """
    body    = request.get_json(force=True) or {}
    command = (body.get("command") or "").strip()
    hosts   = body.get("hosts")  # liste d'IPs optionnelle

    if not command:
        return jsonify({"error": "Commande vide"}), 400

    # Récupère les PCs depuis MongoDB
    col  = get_col()
    pipeline = [
        {"$sort": {"timestamp": DESCENDING}},
        {"$group": {"_id": "$hostname", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
    ]
    docs = list(col.aggregate(pipeline))

    if hosts:
        docs = [d for d in docs if d.get("ip") in hosts]

    if not docs:
        return jsonify({"error": "Aucun PC trouvé"}), 404

    result_q = queue.Queue()

    # Lance un thread par PC
    threads = []
    for doc in docs:
        t = threading.Thread(target=_exec_on_host, args=(doc, command, result_q), daemon=True)
        t.start()
        threads.append(t)

    total = len(threads)

    def generate():
        # Envoie le total d'abord
        yield f"data: {json.dumps({'type': 'start', 'total': total})}\n\n"
        received = 0
        while received < total:
            try:
                result = result_q.get(timeout=35)
                result["type"] = "result"
                yield f"data: {json.dumps(result)}\n\n"
                received += 1
            except queue.Empty:
                break
        yield f"data: {json.dumps({'type': 'done', 'total': total, 'received': received})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
