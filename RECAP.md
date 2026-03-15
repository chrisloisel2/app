# RECAP — Mise à jour application web `physical_data`

> Date : 2026-03-15
> Base de données MongoDB : `physical_data` @ `192.168.88.17:27017`

---

## Vue d'ensemble

L'application a été intégralement mise à jour pour couvrir les **13 collections** de la base `physical_data`.
Chaque collection dispose d'un **CRUD complet** : backend Flask (Blueprint) + frontend React (page dédiée) + fonctions API client.

---

## Architecture

```
/ok
├── backend/
│   ├── app.py                          ← +13 blueprints enregistrés
│   └── routes/
│       ├── projects.py                 ← NOUVEAU
│       ├── rigs.py                     ← NOUVEAU
│       ├── shift_calendar.py           ← NOUVEAU
│       ├── project_planning.py         ← NOUVEAU
│       ├── video_runs.py               ← NOUVEAU
│       ├── qa_results.py               ← NOUVEAU
│       ├── annotation_audits.py        ← NOUVEAU
│       ├── incidents.py                ← NOUVEAU
│       ├── staff_attendance.py         ← NOUVEAU
│       ├── delivery_tracking.py        ← NOUVEAU
│       ├── cost_events.py              ← NOUVEAU
│       ├── rig_status_snapshots.py     ← NOUVEAU
│       ├── kpi_aggregates.py           ← NOUVEAU
│       ├── operateurs.py               ← existant
│       ├── annotateurs.py              ← existant
│       └── scenarios.py                ← existant
└── frontend/src/
    ├── App.jsx                         ← +13 routes
    ├── api/client.js                   ← +65 fonctions API
    ├── components/layout/Sidebar.jsx   ← +4 sections navigation
    └── pages/
        ├── ProjectsPage.jsx            ← NOUVEAU
        ├── RigsPage.jsx                ← NOUVEAU
        ├── ShiftCalendarPage.jsx       ← NOUVEAU
        ├── ProjectPlanningPage.jsx     ← NOUVEAU
        ├── VideoRunsPage.jsx           ← NOUVEAU
        ├── QaResultsPage.jsx           ← NOUVEAU
        ├── AnnotationAuditsPage.jsx    ← NOUVEAU
        ├── IncidentsPage.jsx           ← NOUVEAU
        ├── StaffAttendancePage.jsx     ← NOUVEAU
        ├── DeliveryTrackingPage.jsx    ← NOUVEAU
        ├── CostEventsPage.jsx          ← NOUVEAU
        ├── RigStatusSnapshotsPage.jsx  ← NOUVEAU
        └── KpiAggregatesPage.jsx       ← NOUVEAU
```

---

## Collections & endpoints

### 1. `projects`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/projects` | Liste (filtres : `site_id`, `status`) |
| GET | `/api/projects/<id>` | Détail |
| POST | `/api/projects` | Création |
| PUT | `/api/projects/<id>` | Mise à jour |
| DELETE | `/api/projects/<id>` | Suppression |

**Champs clés** : `_id` (string), `code`, `name`, `site_id`, `status` (active/inactive/closed), `contract` (heures planifiées, SLA, dates), `rig_capacity`

---

### 2. `rigs`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/rigs` | Liste (filtres : `site_id`, `status`) |
| GET | `/api/rigs/<id>` | Détail |
| POST | `/api/rigs` | Création |
| PUT | `/api/rigs/<id>` | Mise à jour |
| DELETE | `/api/rigs/<id>` | Suppression |

**Champs clés** : `code`, `site_id`, `project_ids[]`, `status` (active/inactive/maintenance/retired), `specs` (nb caméras, h/jour max)

---

### 3. `shift_calendar`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/shift-calendar` | Liste (filtres : `site_id`, `date`) |
| GET | `/api/shift-calendar/<id>` | Détail |
| POST | `/api/shift-calendar` | Création |
| PUT | `/api/shift-calendar/<id>` | Mise à jour |
| DELETE | `/api/shift-calendar/<id>` | Suppression |

**Champs clés** : `date` (YYYY-MM-DD), `site_id`, `name` (A/B/C), `start_at`, `end_at`

---

### 4. `project_planning`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/project-planning` | Liste (filtres : `project_id`, `date`) |
| GET | `/api/project-planning/<id>` | Détail |
| POST | `/api/project-planning` | Création |
| PUT | `/api/project-planning/<id>` | Mise à jour |
| DELETE | `/api/project-planning/<id>` | Suppression |

**Champs clés** : `project_id`, `date`, `planned_hours`, `planned_operators`, `planned_active_rigs`, `planned_delivery_deadline`

---

### 5. `video_runs`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/video-runs` | Liste paginée (filtres : `project_id`, `operator_id`, `rig_id`, `shift_id`, `scenario_id`, `qa_status`) |
| GET | `/api/video-runs/<id>` | Détail |
| POST | `/api/video-runs` | Création |
| PUT | `/api/video-runs/<id>` | Mise à jour (pipeline_status, timing, etc.) |
| DELETE | `/api/video-runs/<id>` | Suppression |

**Champs clés** : `video` (video_id, storage_path, durée, codec…), `timing`, `durations`, `quality_flags`, `pipeline_status` (qa/annotation/upload/delivery), `metrics`
**Page frontend** : tableau paginé + modal "Pipeline" pour modifier les statuts + vue JSON détail

---

### 6. `qa_results`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/qa-results` | Liste paginée (filtres : `project_id`, `operator_id`, `shift_id`, `run_id`, `final_decision`) |
| GET | `/api/qa-results/<id>` | Détail |
| POST | `/api/qa-results` | Création |
| PUT | `/api/qa-results/<id>` | Mise à jour (décision, durées, rework) |
| DELETE | `/api/qa-results/<id>` | Suppression |

**Champs clés** : `run_id`, `video_id`, `gate_results[]`, `final_decision` (accepted/rejected/rework/pending), `defects`, durées acceptées/rejetées

---

### 7. `annotation_audits`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/annotation-audits` | Liste paginée (filtres : `project_id`, `annotator_id`, `auditor_id`, `audit_result`) |
| GET | `/api/annotation-audits/<id>` | Détail |
| POST | `/api/annotation-audits` | Création |
| PUT | `/api/annotation-audits/<id>` | Mise à jour (résultat, métriques, issues) |
| DELETE | `/api/annotation-audits/<id>` | Suppression |

**Champs clés** : `annotator_id`, `auditor_id`, `audit_hour_bucket`, `annotation_metrics` (complétude, précision, IAA, temps), `audit_result` (pass/fail/warning), `issues[]`

---

### 8. `incidents`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/incidents` | Liste paginée (filtres : `project_id`, `site_id`, `severity`, `status`, `critical_incident`) |
| GET | `/api/incidents/<id>` | Détail |
| POST | `/api/incidents` | Création |
| PUT | `/api/incidents/<id>` | Mise à jour |
| DELETE | `/api/incidents/<id>` | Suppression |

**Champs clés** : `type`, `severity` (low/medium/high/critical), `critical_incident` (bool), `started_at`, `resolved_at`, `resolution_sec`, `impact`, `root_cause`, `status` (open/resolved/ignored)

---

### 9. `staff_attendance`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/staff-attendance` | Liste paginée (filtres : `project_id`, `shift_id`, `operator_id`, `date`, `present`) |
| GET | `/api/staff-attendance/<id>` | Détail |
| POST | `/api/staff-attendance` | Création |
| PUT | `/api/staff-attendance/<id>` | Mise à jour (présence, heures, autonomie) |
| DELETE | `/api/staff-attendance/<id>` | Suppression |

**Champs clés** : `scheduled`, `present`, `autonomous`, `role`, `hours` (scheduled/paid/productive/training/break/downtime en secondes)

---

### 10. `delivery_tracking`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/delivery-tracking` | Liste paginée (filtres : `project_id`, `shift_id`, `upload_status`, `delivery_status`) |
| GET | `/api/delivery-tracking/<id>` | Détail |
| POST | `/api/delivery-tracking` | Création |
| PUT | `/api/delivery-tracking/<id>` | Mise à jour (upload/delivery/intégrité) |
| DELETE | `/api/delivery-tracking/<id>` | Suppression |

**Champs clés** : `upload` (attempted_at, completed_at, status), `delivery` (planned_at, actual_at, status, on_time), `dataset_integrity` (completeness_rate, data_loss_rate), `queues`

---

### 11. `cost_events`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/cost-events` | Liste paginée (filtres : `project_id`, `site_id`, `date`) |
| GET | `/api/cost-events/<id>` | Détail |
| POST | `/api/cost-events` | Création |
| PUT | `/api/cost-events/<id>` | Mise à jour |
| DELETE | `/api/cost-events/<id>` | Suppression |

**Champs clés** : `costs` (labor/rig/energy/storage/rework/qa), `currency`, `source`
**Page frontend** : affichage du total calculé dynamiquement

---

### 12. `rig_status_snapshots`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/rig-status-snapshots` | Liste paginée (filtres : `rig_id`, `project_id`, `status`) |
| GET | `/api/rig-status-snapshots/<id>` | Détail |
| POST | `/api/rig-status-snapshots` | Création |
| PUT | `/api/rig-status-snapshots/<id>` | Mise à jour |
| DELETE | `/api/rig-status-snapshots/<id>` | Suppression |

**Champs clés** : `rig_id`, `project_id`, `timestamp`, `status` (running/stopped/maintenance/idle)

---

### 13. `kpi_aggregates`
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/kpi-aggregates` | Liste paginée (filtres : `grain`, `project_id`, `site_id`, `date`, `week`, `month`) |
| GET | `/api/kpi-aggregates/<id>` | Détail |
| POST | `/api/kpi-aggregates` | Création |
| PUT | `/api/kpi-aggregates/<id>` | Mise à jour (kpis JSON libre) |
| DELETE | `/api/kpi-aggregates/<id>` | Suppression |

**Champs clés** : `grain` (hour/day/shift/week/month), `scope` (project_id, site_id, shift_id, operator_id, rig_id, annotator_id, scenario_id), `period` (date, week, month, hour_bucket), `kpis` (objet libre)
**Page frontend** : modification des KPIs via éditeur JSON

---

## Navigation (Sidebar)

4 nouvelles sections ont été ajoutées :

| Section | Items |
|---------|-------|
| **Référentiel** | Projets, Rigs, Shifts, Planning |
| **Capture & QA** | Video Runs, QA Results, Annotation Audits, Incidents |
| **Opérations** | Présences, Livraisons, Coûts, Rig Snapshots, KPI Aggregates |

Les sections existantes (Production, Infrastructure, Data Explorer, Administration) sont inchangées.

---

## Conventions techniques

### Backend (Flask)
- Tous les IDs sont des **strings** (pas ObjectId), conformément au schéma MongoDB
- Parsing des dates ISO 8601 avec `replace("Z", "+00:00")`
- Réponses JSON normalisées : `{"ok": true, ...}` ou `{"ok": false, "error": "..."}`
- Pagination via `limit` / `skip` pour les collections volumineuses (video_runs, qa_results, annotation_audits, incidents, staff_attendance, delivery_tracking, cost_events, rig_status_snapshots, kpi_aggregates)
- Validation des enums au niveau de la route (severity, status, grain, final_decision, etc.)

### Frontend (React)
- Pattern uniforme : état `data`/`loading`/`error` + filtres + pagination
- Modals pour create/edit/delete/detail
- Badge colorés pour les enums critiques (severity, qa_status, audit_result…)
- Vue JSON brute (modal "Détail") pour les documents complexes (video_runs, qa_results, annotation_audits, kpi_aggregates)
- Éditeur JSON textarea pour les `kpis` libres (kpi_aggregates)
- Total calculé côté client pour cost_events

---

## Collections existantes (inchangées)

| Collection | Route | Page |
|------------|-------|------|
| `operators` (legacy) | `/api/operateurs` | `/operateurs` |
| `annotators` (legacy) | `/api/annotateurs` | `/annotateurs` |
| `scenarios` | `/api/scenarios` | `/scenarios` |
| `orchestrator_ssh` | `/api/ssh-parc` | `/ssh-parc` |

---

## Résumé des fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `backend/routes/projects.py` | Créé |
| `backend/routes/rigs.py` | Créé |
| `backend/routes/shift_calendar.py` | Créé |
| `backend/routes/project_planning.py` | Créé |
| `backend/routes/video_runs.py` | Créé |
| `backend/routes/qa_results.py` | Créé |
| `backend/routes/annotation_audits.py` | Créé |
| `backend/routes/incidents.py` | Créé |
| `backend/routes/staff_attendance.py` | Créé |
| `backend/routes/delivery_tracking.py` | Créé |
| `backend/routes/cost_events.py` | Créé |
| `backend/routes/rig_status_snapshots.py` | Créé |
| `backend/routes/kpi_aggregates.py` | Créé |
| `backend/app.py` | Modifié (+26 imports/registrations) |
| `frontend/src/api/client.js` | Modifié (+65 fonctions) |
| `frontend/src/App.jsx` | Modifié (+13 routes) |
| `frontend/src/components/layout/Sidebar.jsx` | Modifié (+3 sections, +13 liens) |
| `frontend/src/pages/ProjectsPage.jsx` | Créé |
| `frontend/src/pages/RigsPage.jsx` | Créé |
| `frontend/src/pages/ShiftCalendarPage.jsx` | Créé |
| `frontend/src/pages/ProjectPlanningPage.jsx` | Créé |
| `frontend/src/pages/VideoRunsPage.jsx` | Créé |
| `frontend/src/pages/QaResultsPage.jsx` | Créé |
| `frontend/src/pages/AnnotationAuditsPage.jsx` | Créé |
| `frontend/src/pages/IncidentsPage.jsx` | Créé |
| `frontend/src/pages/StaffAttendancePage.jsx` | Créé |
| `frontend/src/pages/DeliveryTrackingPage.jsx` | Créé |
| `frontend/src/pages/CostEventsPage.jsx` | Créé |
| `frontend/src/pages/RigStatusSnapshotsPage.jsx` | Créé |
| `frontend/src/pages/KpiAggregatesPage.jsx` | Créé |
| `RECAP.md` | Créé |
