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
import re
import paramiko
import threading
import queue
import time

ssh_parc_bp = Blueprint("ssh_parc", __name__)

# ── Traduction commandes Linux → PowerShell ────────────────────────────────────
# Commandes simples : remplacement direct
_CMD_MAP = {
    "ls":      "Get-ChildItem",
    "pwd":     "Get-Location",
    "whoami":  "whoami",          # existe nativement sur Windows
    "uname":   "(Get-ComputerInfo | Select-Object -ExpandProperty OsName)",
    "uname -a":"(Get-ComputerInfo | Select-Object OsName,OsVersion,CsName | Format-List)",
    "uptime":  "(Get-Date) - (gcim Win32_OperatingSystem).LastBootUpTime | Select-Object Days,Hours,Minutes",
    "df":      "Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free",
    "df -h":   "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}},@{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}",
    "free":    "(Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory)",
    "free -h": "(Get-CimInstance Win32_OperatingSystem | Select-Object @{N='Total(GB)';E={[math]::Round($_.TotalVisibleMemorySize/1MB,2)}},@{N='Free(GB)';E={[math]::Round($_.FreePhysicalMemory/1MB,2)}})",
    "top":     "Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name,CPU,WorkingSet | Format-Table -AutoSize",
    "ps":      "Get-Process | Select-Object Name,Id,CPU,WorkingSet | Format-Table -AutoSize",
    "ps aux":  "Get-Process | Select-Object Name,Id,CPU,WorkingSet | Format-Table -AutoSize",
    "ifconfig":"ipconfig",
    "ip a":    "ipconfig /all",
    "ip addr": "ipconfig /all",
    "hostname":"hostname",
    "date":    "Get-Date",
    "env":     "Get-ChildItem Env: | Format-Table -AutoSize",
    "printenv":"Get-ChildItem Env: | Format-Table -AutoSize",
    "cat /etc/os-release": "(Get-ComputerInfo | Select-Object OsName,OsVersion | Format-List)",
    "netstat": "netstat -ano",
    "netstat -tulpn": "netstat -ano",
    "which":   "Get-Command",
    "clear":   "Clear-Host",
    "history": "Get-History | Select-Object -ExpandProperty CommandLine",
}

# Patterns regex pour commandes avec arguments
_CMD_PATTERNS = [
    # cat <fichier>
    (re.compile(r"^cat\s+(.+)$"),         lambda m: f"Get-Content {m.group(1)}"),
    # grep <pattern> <fichier>
    (re.compile(r"^grep\s+(.+)$"),        lambda m: f"Select-String {m.group(1)}"),
    # find <path> -name <pat>
    (re.compile(r"^find\s+(\S+)\s+-name\s+(.+)$"), lambda m: f"Get-ChildItem -Path {m.group(1)} -Recurse -Filter {m.group(2)}"),
    # mkdir
    (re.compile(r"^mkdir\s+(.+)$"),       lambda m: f"New-Item -ItemType Directory -Path {m.group(1)}"),
    # rm <fichier>
    (re.compile(r"^rm\s+(.+)$"),          lambda m: f"Remove-Item {m.group(1)}"),
    # cp <src> <dst>
    (re.compile(r"^cp\s+(\S+)\s+(\S+)$"),lambda m: f"Copy-Item {m.group(1)} {m.group(2)}"),
    # mv <src> <dst>
    (re.compile(r"^mv\s+(\S+)\s+(\S+)$"),lambda m: f"Move-Item {m.group(1)} {m.group(2)}"),
    # echo
    (re.compile(r"^echo\s+(.+)$"),        lambda m: f"Write-Output {m.group(1)}"),
    # which <cmd>
    (re.compile(r"^which\s+(.+)$"),       lambda m: f"Get-Command {m.group(1)}"),
    # kill <pid>
    (re.compile(r"^kill\s+(\d+)$"),       lambda m: f"Stop-Process -Id {m.group(1)}"),
    # tail -n <n> <fichier>
    (re.compile(r"^tail\s+(?:-n\s+(\d+)\s+)?(.+)$"), lambda m: f"Get-Content {m.group(2)} -Tail {m.group(1) or 10}"),
    # head -n <n> <fichier>
    (re.compile(r"^head\s+(?:-n\s+(\d+)\s+)?(.+)$"), lambda m: f"Get-Content {m.group(2)} -TotalCount {m.group(1) or 10}"),
]


def translate_command(cmd: str) -> str:
    """Traduit une commande Linux en PowerShell si nécessaire."""
    stripped = cmd.strip()
    # Exact match
    if stripped in _CMD_MAP:
        return _CMD_MAP[stripped]
    # Pattern match
    for pattern, builder in _CMD_PATTERNS:
        m = pattern.match(stripped)
        if m:
            return builder(m)
    # Commande déjà Windows ou inconnue — on la passe telle quelle
    return stripped


# ── Nettoyage sortie PTY Windows ──────────────────────────────────────────────
_ANSI_RE   = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b.")
_PS_PROMPT = re.compile(r"^PS\s+[A-Z]:\\.*?>?\s*$", re.MULTILINE)

def clean_pty_output(raw: str, original_cmd: str, translated_cmd: str) -> str:
    """Nettoie la sortie brute d'un PTY Windows/PowerShell."""
    # Supprime séquences ANSI/VT
    text = _ANSI_RE.sub("", raw)
    # Normalise les sauts de ligne Windows
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    lines = text.splitlines()
    cleaned = []
    for line in lines:
        stripped = line.rstrip()
        # Ignore les prompts PS
        if _PS_PROMPT.match(stripped):
            continue
        # Ignore les lignes qui répètent la commande (echo du PTY)
        if stripped == translated_cmd or stripped == original_cmd:
            continue
        # Ignore lignes vides consécutives (garde max 1)
        if stripped == "" and cleaned and cleaned[-1] == "":
            continue
        cleaned.append(stripped)

    # Retire les lignes vides en début/fin
    while cleaned and cleaned[0] == "":
        cleaned.pop(0)
    while cleaned and cleaned[-1] == "":
        cleaned.pop()

    return "\n".join(cleaned)


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


def _exec_on_host(doc, original_cmd, translated_cmd, result_queue):
    """Exécute une commande SSH sur un host et pousse le résultat dans la queue."""
    hostname = doc.get("hostname") or doc.get("ip") or "?"
    ip       = doc.get("ip")
    username = doc.get("username") or "root"
    port     = int(doc.get("port") or 22)

    if not ip:
        result_queue.put({"hostname": hostname, "ip": None, "stdout": "", "stderr": "Pas d'IP", "exit_code": -1})
        return

    password = doc.get("password") or None

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, port=port, username=username, password=password, timeout=10,
                    look_for_keys=False, allow_agent=False)
        channel = ssh.get_transport().open_session()
        channel.get_pty()
        channel.exec_command(translated_cmd)
        channel.settimeout(30)

        out_buf = b""
        while True:
            if channel.recv_ready():
                out_buf += channel.recv(4096)
            elif channel.exit_status_ready():
                while channel.recv_ready():
                    out_buf += channel.recv(4096)
                break
            else:
                time.sleep(0.05)

        raw  = out_buf.decode("utf-8", errors="replace")
        out  = clean_pty_output(raw, original_cmd, translated_cmd)
        code = channel.recv_exit_status()
        result_queue.put({"hostname": hostname, "ip": ip, "stdout": out, "stderr": "", "exit_code": code})
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
    body           = request.get_json(force=True) or {}
    original_cmd   = (body.get("command") or "").strip()
    hosts          = body.get("hosts")  # liste d'IPs optionnelle

    if not original_cmd:
        return jsonify({"error": "Commande vide"}), 400

    translated_cmd = translate_command(original_cmd)

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
        t = threading.Thread(target=_exec_on_host, args=(doc, original_cmd, translated_cmd, result_q), daemon=True)
        t.start()
        threads.append(t)

    total = len(threads)

    def generate():
        # Envoie le total + la commande traduite (pour info frontend)
        yield f"data: {json.dumps({'type': 'start', 'total': total, 'translated': translated_cmd})}\n\n"
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
