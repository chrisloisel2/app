"""
Migration : operateurs/annotateurs → operators/annotators
- Copie les docs des anciennes collections vers les nouvelles
- Renomme nom_utilisateur → username
- Hashe les mots de passe en clair avec bcrypt (si pas déjà hashé)
- Ne touche pas aux docs déjà présents dans la cible (upsert par username)

Usage :  python3 migrate_users.py
"""
import sys
import re

try:
    import bcrypt
except ImportError:
    print("ERREUR: bcrypt non installé — pip install bcrypt")
    sys.exit(1)

try:
    from pymongo import MongoClient
except ImportError:
    print("ERREUR: pymongo non installé")
    sys.exit(1)

MONGODB_URI = "mongodb://admin:admin123@192.168.88.17:27017/"
DB_NAME     = "physical_data"

client = MongoClient(MONGODB_URI)
db     = client[DB_NAME]


def is_bcrypt(s: str) -> bool:
    return bool(s and re.match(r"^\$2[aby]\$\d+\$", s))


def migrate(src_name: str, dst_name: str, label: str):
    src = db[src_name]
    dst = db[dst_name]

    docs = list(src.find({}))
    if not docs:
        print(f"[{label}] Collection source '{src_name}' vide — rien à migrer.")
        return

    print(f"\n[{label}] {len(docs)} document(s) dans '{src_name}' → '{dst_name}'")

    migrated = skipped = 0
    for doc in docs:
        # Résoudre le champ username
        username = (
            doc.get("username")
            or doc.get("nom_utilisateur")
            or doc.get("login")
            or ""
        ).strip()

        if not username:
            print(f"  ⚠ Doc {doc['_id']} : pas de username trouvé, ignoré.")
            continue

        # Éviter les doublons
        if dst.find_one({"username": username}):
            print(f"  · '{username}' déjà présent dans '{dst_name}', ignoré.")
            skipped += 1
            continue

        # Hash du mot de passe si en clair
        raw_pwd = doc.get("password") or doc.get("mdp") or ""
        if is_bcrypt(raw_pwd):
            hashed = raw_pwd
        elif raw_pwd:
            hashed = bcrypt.hashpw(raw_pwd.encode(), bcrypt.gensalt()).decode()
            print(f"  ✓ Mot de passe de '{username}' hashé.")
        else:
            # Mot de passe vide : on met un hash de chaîne vide
            hashed = bcrypt.hashpw(b"", bcrypt.gensalt()).decode()
            print(f"  ⚠ '{username}' : mot de passe vide, hash de '' utilisé.")

        new_doc = {
            "username":     username,
            "password":     hashed,
            "numero_poste": doc.get("numero_poste", ""),
        }
        dst.insert_one(new_doc)
        print(f"  ✓ '{username}' migré.")
        migrated += 1

    print(f"[{label}] Résultat : {migrated} migré(s), {skipped} ignoré(s).")


print("=== Migration des utilisateurs ===")
migrate("operateurs",  "operators",  "Opérateurs")
migrate("annotateurs", "annotators", "Annotateurs")
print("\n=== Terminé ===")

# Vérification finale
print("\n=== Contenu final ===")
for col_name in ("operators", "annotators"):
    docs = list(db[col_name].find({}, {"password": 0}))
    print(f"\n{col_name} ({len(docs)} doc(s)) :")
    for d in docs:
        print(f"  {d}")
