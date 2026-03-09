# Spécification des données — Salle de récolte
**Topic Kafka :** `monitoring`
**Producteurs attendus :** 30 PCs d'enregistrement · 1 Spool · 1 NAS

---

## 1. Messages depuis les PCs (30 postes)

Chaque poste publie périodiquement un message JSON sur `monitoring`.

**Champ discriminant :** `"source": "pc"`

```json
{
  "source": "pc",
  "pc_id": 1,
  "hostname": "pc-01",
  "timestamp": "2026-03-05T14:23:00Z",

  "sqlite_queue": {
    "pending_sessions": 3,
    "total_records": 1240,
    "oldest_pending_iso": "2026-03-05T08:00:00Z",
    "sessions": [
      { "session_id": "s001", "records": 412, "status": "pending" },
      { "session_id": "s002", "records": 396, "status": "pending" },
      { "session_id": "s003", "records": 432, "status": "pending" }
    ]
  },

  "last_send": {
    "session_id": "s000",
    "sent_at": "2026-03-05T14:20:00Z",
    "status": "success",
    "records_sent": 412
  }
}
```

### Détail des champs PC

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `source` | `"pc"` | ✅ | Discriminant source |
| `pc_id` | integer 1–30 | ✅ | Identifiant unique du poste |
| `hostname` | string | ✅ | Nom réseau du poste (ex: `"PC-00018"` pour le poste 18) |
| `timestamp` | ISO 8601 UTC | ✅ | Horodatage d'émission du message |
| `sqlite_queue.pending_sessions` | integer | ✅ | Nombre de sessions en attente d'envoi |
| `sqlite_queue.total_records` | integer | ✅ | Total enregistrements en file |
| `sqlite_queue.oldest_pending_iso` | ISO 8601 UTC | ✅ | Date de la session la plus ancienne en attente |
| `sqlite_queue.sessions[]` | array | ✅ | Liste des sessions en attente (max recommandé : 20) |
| `sqlite_queue.sessions[].session_id` | string | ✅ | Identifiant de session |
| `sqlite_queue.sessions[].records` | integer | ✅ | Nombre d'enregistrements dans cette session |
| `sqlite_queue.sessions[].status` | `"pending"` \| `"sending"` \| `"failed"` | ✅ | Statut de la session |
| `last_send.session_id` | string | ✅ | Dernière session envoyée |
| `last_send.sent_at` | ISO 8601 UTC | ✅ | Heure d'envoi |
| `last_send.status` | `"success"` \| `"failed"` \| `"in_progress"` | ✅ | Résultat de l'envoi |
| `last_send.records_sent` | integer | ✅ | Nombre d'enregistrements transmis |
| `disconnected` | boolean | ⬜ | `true` = message explicite de déconnexion (voir ci-dessous) |

### Message de déconnexion

Pour signaler qu'un PC se déconnecte proprement, envoyer :

```json
{
  "source": "pc",
  "pc_id": 5,
  "hostname": "PC-00005",
  "timestamp": "2026-03-05T18:00:00Z",
  "disconnected": true
}
```

Le backend conserve les dernières données connues du poste et le marque comme déconnecté.

### Statuts de poste (affichage blueprint)

| Statut | Couleur | Condition |
|---|---|---|
| `active` | Vert | Vu au moins une fois, aucune session en attente |
| `sending` | Ambre | `last_send.status == "in_progress"` |
| `queued` | Violet | `sqlite_queue.pending_sessions > 0` |
| `disconnected` | Rouge pâle | Message `disconnected: true` reçu |
| `never_seen` | Gris foncé | Jamais reçu de message depuis ce PC |

> **Important :** un PC est considéré **connecté** dès qu'il a envoyé au moins un message, et reste dans cet état tant qu'aucun message `disconnected: true` n'est reçu. Il n'y a pas de timeout automatique.

---

## 2. Messages depuis le Spool

Le Spool est le relais intermédiaire entre les PCs et le NAS.

**Champ discriminant :** `"source": "spool"`

```json
{
  "source": "spool",
  "timestamp": "2026-03-05T14:23:10Z",

  "inbound_queue": [
    {
      "pc_id": 3,
      "session_id": "s010",
      "received_at": "2026-03-05T14:22:00Z",
      "size_mb": 12.4
    }
  ],

  "processed_today": 58,
  "forwarded_to_nas": 55,
  "failed": 3,

  "current_transfer": {
    "from_pc": 7,
    "session_id": "s011",
    "progress_pct": 67,
    "speed_mbps": 45.2
  }
}
```

### Détail des champs Spool

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `source` | `"spool"` | ✅ | Discriminant source |
| `timestamp` | ISO 8601 UTC | ✅ | Horodatage d'émission |
| `inbound_queue` | array | ✅ | Sessions reçues des PCs, en attente de transfert NAS |
| `inbound_queue[].pc_id` | integer | ✅ | PC source |
| `inbound_queue[].session_id` | string | ✅ | Identifiant de session |
| `inbound_queue[].received_at` | ISO 8601 UTC | ✅ | Heure de réception depuis le PC |
| `inbound_queue[].size_mb` | float | ✅ | Taille estimée en mégaoctets |
| `processed_today` | integer | ✅ | Sessions traitées depuis minuit |
| `forwarded_to_nas` | integer | ✅ | Sessions transférées avec succès vers le NAS |
| `failed` | integer | ✅ | Sessions en échec (transfert PC→Spool ou Spool→NAS) |
| `current_transfer` | object \| null | ✅ | Transfert actif (null si aucun) |
| `current_transfer.from_pc` | integer | ✅ | PC source du transfert en cours |
| `current_transfer.session_id` | string | ✅ | Session en cours de transfert |
| `current_transfer.progress_pct` | integer 0–100 | ✅ | Progression en pourcentage |
| `current_transfer.speed_mbps` | float | ✅ | Vitesse de transfert (Mo/s) |

---

## 3. Messages depuis le NAS

Le NAS est le stockage final des sessions de récolte.

**Champ discriminant :** `"source": "nas"`

```json
{
  "source": "nas",
  "timestamp": "2026-03-05T14:23:15Z",

  "total_sessions": 4200,
  "disk_used_gb": 1842,
  "disk_total_gb": 8000,

  "last_write": {
    "session_id": "s009",
    "written_at": "2026-03-05T14:21:00Z",
    "size_mb": 11.8
  },

  "status": "online"
}
```

### Détail des champs NAS

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `source` | `"nas"` | ✅ | Discriminant source |
| `timestamp` | ISO 8601 UTC | ✅ | Horodatage d'émission |
| `total_sessions` | integer | ✅ | Nombre total de sessions stockées |
| `disk_used_gb` | float | ✅ | Espace disque utilisé en Go |
| `disk_total_gb` | float | ✅ | Capacité totale en Go |
| `last_write.session_id` | string | ✅ | Dernière session écrite |
| `last_write.written_at` | ISO 8601 UTC | ✅ | Heure d'écriture |
| `last_write.size_mb` | float | ✅ | Taille de la session écrite |
| `status` | `"online"` \| `"degraded"` \| `"offline"` | ✅ | État du NAS |

---

## 4. Configuration de publication recommandée

| Source | Fréquence recommandée | Déclencheur alternatif |
|---|---|---|
| PC | Toutes les 5 secondes | + à chaque changement de statut d'envoi |
| Spool | Toutes les 2 secondes | + à chaque début/fin de transfert |
| NAS | Toutes les 10 secondes | + à chaque écriture réussie |

---

## 5. Architecture du flux de données

```
┌─────────────────────────────────────────────────────┐
│                    SALLE DE RÉCOLTE                 │
│                                                     │
│  PC-01 ─┐                                           │
│  PC-02 ─┤                                           │
│  ...    ├──→ [ SPOOL ] ──NFS──→ [ NAS ]             │
│  PC-29 ─┤         ↑                  ↑              │
│  PC-30 ─┘         │                  │              │
│                   └──────────────────┘              │
└─────────────────────────────────────────────────────┘
          ↓ Kafka monitoring (JSON)
    [ Backend Flask consumer ]
          ↓ GET /api/salle (polling 3s)
    [ Frontend React SalleRecoltePage ]
```

---

## 6. Endpoint API backend

```
GET /api/salle
```

Retourne un snapshot JSON de l'état courant :

```json
{
  "connected": true,
  "last_update": "2026-03-05T14:23:15Z",
  "errors": [],
  "pcs": [ /* 30 éléments, un par pc_id 1–30 */ ],
  "spool": { /* dernier message spool */ },
  "nas": { /* dernier message nas */ }
}
```

Les PCs sans message reçu apparaissent avec `"_offline": true`.

---

*Document généré le 2026-03-05 — v1.0*
