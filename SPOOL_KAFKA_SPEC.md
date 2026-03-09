# Spool — Data attendue via Kafka (monitoring)

## Structure exacte du message

```json
{
  "source": "spool",
  "timestamp": "2026-03-05T14:23:10Z",
  "inbound_queue": [
    {
      "pc_id": 3,
      "session_id": "s010",
      "received_at": "2026-03-05T14:20:00Z",
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

---

## Détail champ par champ

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `source` | `string` | **OUI** | Doit valoir exactement `"spool"` — c'est ce qui route le message dans le consumer |
| `timestamp` | `string` (ISO 8601 UTC) | OUI | Horodatage de l'émission du message |
| `inbound_queue` | `array` | OUI | Liste des sessions en attente de traitement par le spool |
| `inbound_queue[].pc_id` | `int` (1–30) | OUI | ID du PC source |
| `inbound_queue[].session_id` | `string` | OUI | Identifiant de session |
| `inbound_queue[].received_at` | `string` (ISO 8601) | OUI | Date/heure de réception par le spool |
| `inbound_queue[].size_mb` | `float` | OUI | Taille de la session en mégaoctets |
| `processed_today` | `int` | OUI | Nombre total de sessions traitées aujourd'hui |
| `forwarded_to_nas` | `int` | OUI | Nombre de sessions transmises avec succès au NAS |
| `failed` | `int` | OUI | Nombre de sessions en échec |
| `current_transfer` | `object` ou `null` | OUI | Transfert en cours, `null` si aucun |
| `current_transfer.from_pc` | `int` (1–30) | OUI | PC dont on transfère les données |
| `current_transfer.session_id` | `string` | OUI | Session en cours de transfert |
| `current_transfer.progress_pct` | `int` (0–100) | OUI | Avancement en pourcentage |
| `current_transfer.speed_mbps` | `float` | OUI | Vitesse de transfert en Mo/s |

---

## Comportement du consumer

- Le message est reçu en **raw bytes** sur `monitoring`, désérialisé manuellement en JSON
- Le routing se fait via `source == "spool"`
- Le message entier est stocké tel quel dans `_state["spool"]` — aucune transformation n'est appliquée
- A chaque message reçu, tous les clients WebSocket connectés sur `/api/salle/ws` reçoivent un snapshot complet mis à jour
- Groupe consumer : `salle-recolte-monitor`, offset reset : `latest`

---

## Points critiques

1. **`source: "spool"` est mandatory** — un message sans ce champ exact est ignoré silencieusement (loggé en debug)
2. L'**encodage doit être UTF-8** — le décodage est fait explicitement avec `.decode("utf-8")`
3. `inbound_queue` peut être un tableau vide `[]` si rien n'est en attente
4. `current_transfer` peut être `null` si aucun transfert n'est en cours
