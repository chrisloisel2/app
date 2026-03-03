#!/usr/bin/env python3
"""
register_sessions.py
====================
Vérifie que toutes les sessions présentes sur le NAS (monté en NFS)
possèdent bien les fichiers attendus et affiche un rapport.

Usage :
    python3 /scripts/register_sessions.py

Variables d'environnement :
    NAS_SESSIONS_DIR  — chemin local du dossier sessions (défaut : /nas/sessions)
"""

import json
import os
import re
import sys

NAS_SESSIONS_DIR = os.environ.get("NAS_SESSIONS_DIR", "/nas/sessions")
SESSION_RE = re.compile(r"^session_")
EXPECTED_FILES = ["tracker_positions.csv", "pince1_data.csv", "pince2_data.csv", "metadata.json"]


def check_session(session_dir: str) -> dict:
    result = {"session": session_dir, "ok": True, "missing": [], "metadata": None}
    for fname in EXPECTED_FILES:
        fpath = os.path.join(NAS_SESSIONS_DIR, session_dir, fname)
        if not os.path.exists(fpath):
            result["missing"].append(fname)
            result["ok"] = False

    meta_path = os.path.join(NAS_SESSIONS_DIR, session_dir, "metadata.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, encoding="utf-8") as f:
                result["metadata"] = json.load(f)
        except Exception as e:
            result["metadata_error"] = str(e)

    return result


def main():
    print(f"=== Vérification des sessions NAS ===")
    print(f"Dossier : {NAS_SESSIONS_DIR}\n")

    if not os.path.isdir(NAS_SESSIONS_DIR):
        print(f"[ERREUR] Dossier introuvable : {NAS_SESSIONS_DIR}")
        print("Vérifiez que le montage NFS est actif.")
        sys.exit(1)

    sessions = sorted(
        [d for d in os.listdir(NAS_SESSIONS_DIR)
         if SESSION_RE.match(d) and os.path.isdir(os.path.join(NAS_SESSIONS_DIR, d))]
    )

    if not sessions:
        print("Aucune session trouvée.")
        sys.exit(1)

    print(f"Sessions trouvées : {len(sessions)}\n")
    ok_count = 0
    for s in sessions:
        r = check_session(s)
        status = "OK" if r["ok"] else f"MANQUANT: {', '.join(r['missing'])}"
        meta_id = ""
        if isinstance(r.get("metadata"), dict):
            meta_id = f"  — session_id={r['metadata'].get('session_id', '')}"
        print(f"  [{status}] {s}{meta_id}")
        if r["ok"]:
            ok_count += 1

    print(f"\n=== {ok_count}/{len(sessions)} sessions complètes ===")


if __name__ == "__main__":
    main()
