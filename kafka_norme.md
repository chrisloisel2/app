# Kafka Events — Topic `monitoring`

Tous les messages sont publiés sur `KAFKA_SALLE_TOPIC` (`monitoring`) via `KafkaEventPublisher`.

## Format commun

Chaque message est un objet JSON **plat**. Les 5 champs de base sont toujours présents,
auxquels s'ajoutent les champs spécifiques à l'événement :

```json
{
  "type":       "<event_type>",
  "station_id": "<hostname>",
  "ts":         1741437600.123,
  "operator":   "<username>",
  "scenario":   "<nom_scenario>"
}
```

| Champ        | Type   | Description                                                        |
|--------------|--------|--------------------------------------------------------------------|
| `type`       | string | Identifiant de l'événement                                         |
| `station_id` | string | Hostname du poste opérateur                                        |
| `ts`         | float  | Timestamp UNIX (secondes, décimales ms)                            |
| `operator`   | string | Nom de l'opérateur connecté (`""` si non disponible)              |
| `scenario`   | string | Nom du scénario sélectionné (`""` si non disponible)              |

> **Source** : les événements émis par `spool_sender` ont `operator` et `scenario` à `""`
> car le daemon n'a pas accès au contexte de session.

---

## Événements

### `operator_connected`
Émis à la connexion de l'opérateur (après login + sélection du scénario).

**Source :** `ui/main_app.py`

```json
{
  "type":       "operator_connected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "operator":   "chris",
  "scenario":   "pick_and_place"
}
```

> `operator` et `scenario` sont aussi dans le payload (redondant avec les champs de base,
> conservé pour compatibilité).

---

### `app_closed`
Émis juste avant la fermeture de l'application.

**Source :** `ui/main_app.py`

```json
{
  "type":       "app_closed",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place"
}
```

Aucun champ supplémentaire.

---

### `station_disconnected`
Émis juste avant la fermeture propre de la station (`salle_reporter.stop()` ou `KafkaEventSender.send_disconnect_ping()`).

**Source :** `services/salle_reporter.py`, `services/orchestrator.py`

```json
{
  "type":       "station_disconnected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "",
  "scenario":   ""
}
```

Aucun champ supplémentaire.

---

### `station_alert`
Émis quand l'opérateur active ou désactive le bouton HELP. Émis **uniquement si l'état change**.

**Source :** `services/salle_reporter.py`

```json
{
  "type":       "station_alert",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "active":     true
}
```

| Champ    | Type | Description                                   |
|----------|------|-----------------------------------------------|
| `active` | bool | `true` = alerte activée, `false` = désactivée |

---

### `gripper_connected`
Émis quand un gripper Arduino est détecté et connecté sur le port série.

**Source :** `ui/main_app.py`

```json
{
  "type":       "gripper_connected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "side":       "right",
  "port":       "COM3"
}
```

| Champ  | Type   | Valeurs          | Description             |
|--------|--------|------------------|-------------------------|
| `side` | string | `right`, `left`  | Côté du gripper         |
| `port` | string |                  | Port série (ex: `COM3`) |

---

### `gripper_disconnected`
Émis quand la connexion série d'un gripper est perdue.

**Source :** `ui/main_app.py`

```json
{
  "type":       "gripper_disconnected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "side":       "left"
}
```

| Champ  | Type   | Valeurs          | Description     |
|--------|--------|------------------|-----------------|
| `side` | string | `right`, `left`  | Côté du gripper |

---

### `gripper_switch_on`
Émis sur la transition OFF → ON du switch physique du gripper **droit** (déclenche le recording).

**Source :** `ui/main_app.py`

```json
{
  "type":       "gripper_switch_on",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "side":       "right"
}
```

| Champ  | Type   | Valeurs   | Description     |
|--------|--------|-----------|-----------------|
| `side` | string | `"right"` | Toujours droit  |

---

### `gripper_switch_off`
Émis sur la transition ON → OFF du switch physique du gripper **droit** (arrête le recording).

**Source :** `ui/main_app.py`

```json
{
  "type":       "gripper_switch_off",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "side":       "right"
}
```

| Champ  | Type   | Valeurs   | Description     |
|--------|--------|-----------|-----------------|
| `side` | string | `"right"` | Toujours droit  |

---

### `session_failed`
Émis quand le switch **gauche** est activé pendant un enregistrement (marque la session comme ratée).

**Source :** `ui/main_app.py`

```json
{
  "type":       "session_failed",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "side":       "left"
}
```

| Champ  | Type   | Valeurs  | Description                      |
|--------|--------|----------|----------------------------------|
| `side` | string | `"left"` | Switch gauche = marquage FAILED  |

---

### `cameras_detected`
Émis après la détection initiale des caméras USB.

**Source :** `ui/main_app.py`

```json
{
  "type":       "cameras_detected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "count":      3,
  "matched":    3,
  "cameras": [
    { "id": 0, "position": "right", "serial": "ABC123", "db_match": true },
    { "id": 1, "position": "left",  "serial": "DEF456", "db_match": true },
    { "id": 2, "position": "front", "serial": "GHI789", "db_match": true }
  ]
}
```

| Champ     | Type  | Description                                     |
|-----------|-------|-------------------------------------------------|
| `count`   | int   | Nombre total de caméras détectées               |
| `matched` | int   | Nombre de caméras reconnues en base de données  |
| `cameras` | array | Liste des caméras (voir objet ci-dessous)       |

**Objet caméra :**

| Champ      | Type   | Description                               |
|------------|--------|-------------------------------------------|
| `id`       | int    | Index de la caméra                        |
| `position` | string | Position (`right`, `left`, `front`, …)    |
| `serial`   | string | Numéro de série USB                       |
| `db_match` | bool   | La caméra est reconnue en base de données |

---

### `tracker_connected`
Émis quand un tracker VR passe de déconnecté à connecté.

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_connected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        0,
  "serial":     "LHR-AABBCCDD"
}
```

| Champ    | Type   | Description              |
|----------|--------|--------------------------|
| `idx`    | int    | Index du tracker         |
| `serial` | string | Numéro de série SteamVR  |

---

### `tracker_disconnected`
Émis quand un tracker VR perd la connexion.

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_disconnected",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        0,
  "serial":     "LHR-AABBCCDD"
}
```

| Champ    | Type   | Description              |
|----------|--------|--------------------------|
| `idx`    | int    | Index du tracker         |
| `serial` | string | Numéro de série SteamVR  |

---

### `tracker_lost`
Émis quand un tracker connecté perd le tracking (hors champ, occultation).

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_lost",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        1
}
```

| Champ | Type | Description      |
|-------|------|------------------|
| `idx` | int  | Index du tracker |

---

### `tracker_recovered`
Émis quand un tracker retrouve le tracking après une perte.

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_recovered",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        1
}
```

| Champ | Type | Description      |
|-------|------|------------------|
| `idx` | int  | Index du tracker |

---

### `tracker_low_battery`
Émis **une seule fois** par session quand la batterie d'un tracker passe sous 10%.

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_low_battery",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        2,
  "battery":    0.08
}
```

| Champ     | Type  | Description                            |
|-----------|-------|----------------------------------------|
| `idx`     | int   | Index du tracker                       |
| `battery` | float | Niveau batterie (0.0 – 1.0), ici < 0.10 |

---

### `tracker_critical_battery`
Émis **une seule fois** par session quand la batterie d'un tracker passe sous 5%.

**Source :** `ui/main_app.py`

```json
{
  "type":       "tracker_critical_battery",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "idx":        2,
  "battery":    0.03
}
```

| Champ     | Type  | Description                            |
|-----------|-------|----------------------------------------|
| `idx`     | int   | Index du tracker                       |
| `battery` | float | Niveau batterie (0.0 – 1.0), ici < 0.05 |

---

### `recording_started`
Émis au démarrage d'un enregistrement.

**Source :** `ui/main_app.py`

```json
{
  "type":       "recording_started",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "trigger":    "switch"
}
```

| Champ     | Type   | Valeurs                    | Description                         |
|-----------|--------|----------------------------|-------------------------------------|
| `trigger` | string | `switch`, `manual`, `auto` | Ce qui a déclenché l'enregistrement |

---

### `recording_stopped`
Émis à l'arrêt d'un enregistrement.

**Source :** `ui/main_app.py`

```json
{
  "type":       "recording_stopped",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "chris",
  "scenario":   "pick_and_place",
  "duration_s": 42.3,
  "failed":     false
}
```

| Champ        | Type  | Description                              |
|--------------|-------|------------------------------------------|
| `duration_s` | float | Durée de l'enregistrement en secondes    |
| `failed`     | bool  | `true` si la session a été marquée FAILED |

---

### `upload_queued`
Émis quand une session terminée est ajoutée à la queue d'upload.

**Source :** `ui/main_app.py`

```json
{
  "type":          "upload_queued",
  "station_id":    "PC-01",
  "ts":            1741437600.0,
  "operator":      "chris",
  "scenario":      "pick_and_place",
  "session_id":    "20250308_143200",
  "scenario":      "pick_and_place",
  "is_failed":     false,
  "pending_count": 2
}
```

| Champ           | Type   | Description                                   |
|-----------------|--------|-----------------------------------------------|
| `session_id`    | string | Nom du dossier de session                     |
| `scenario`      | string | Nom du scénario (redondant avec champ de base)|
| `is_failed`     | bool   | `true` si la session est marquée FAILED       |
| `pending_count` | int    | Nombre de sessions en attente après cet ajout |

---

### `upload_started`
Émis par `spool_sender` quand il commence à uploader une session.

**Source :** `spool_sender.py` — `operator` et `scenario` valent `""` (daemon sans contexte)

```json
{
  "type":       "upload_started",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "",
  "scenario":   "",
  "session_id": "20250308_143200",
  "scenario":   "pick_and_place"
}
```

| Champ        | Type   | Description                                    |
|--------------|--------|------------------------------------------------|
| `session_id` | string | Nom du dossier de session                      |
| `scenario`   | string | Nom du scénario (dans payload, pas dans contexte) |

---

### `upload_completed`
Émis par `spool_sender` quand un upload se termine avec succès.

**Source :** `spool_sender.py` — `operator` et `scenario` valent `""` (daemon sans contexte)

```json
{
  "type":       "upload_completed",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "",
  "scenario":   "",
  "session_id": "20250308_143200",
  "scenario":   "pick_and_place",
  "records":    1247,
  "elapsed_s":  38.4
}
```

| Champ        | Type   | Description                                       |
|--------------|--------|---------------------------------------------------|
| `session_id` | string | Nom du dossier de session                         |
| `scenario`   | string | Nom du scénario (dans payload, pas dans contexte) |
| `records`    | int    | Nombre de fichiers uploadés                       |
| `elapsed_s`  | float  | Durée totale de l'upload en secondes              |

---

### `upload_failed`
Émis par `spool_sender` quand un upload échoue (dossier introuvable, erreur réseau, 0 fichier envoyé, exception).

**Source :** `spool_sender.py` — `operator` et `scenario` valent `""` (daemon sans contexte)

```json
{
  "type":       "upload_failed",
  "station_id": "PC-01",
  "ts":         1741437600.0,
  "operator":   "",
  "scenario":   "",
  "session_id": "20250308_143200",
  "scenario":   "pick_and_place",
  "error":      "Connection refused"
}
```

| Champ        | Type   | Description                                       |
|--------------|--------|---------------------------------------------------|
| `session_id` | string | Nom du dossier de session                         |
| `scenario`   | string | Nom du scénario (dans payload, pas dans contexte) |
| `error`      | string | Message d'erreur (tronqué à 500 caractères)       |
