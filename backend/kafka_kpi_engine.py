"""
kafka_kpi_engine.py
===================
Accumulateur KPI temps réel alimenté par les événements Kafka.

Principe :
  - Chaque événement reçu par kafka_consumer appelle on_event(msg).
  - L'état est accumulé in-memory dans _state (thread-safe).
  - get_snapshot() retourne les KPIs calculés à l'instant T.
  - Un thread de fond persiste un snapshot complet en MongoDB
    toutes les MONGO_FLUSH_INTERVAL secondes, et aussi à chaque
    upload_completed / recording_stopped.

Collections MongoDB :
  kafka_kpi_snapshots  — snapshots périodiques globaux
  kafka_sessions       — une entrée par session (upsert sur session_id)
  kafka_operator_stats — cumuls par opérateur/jour (upsert sur operator+date)
"""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone, date
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

FAULT_WINDOW_S       = 3600    # fenêtre glissante pour fréquence de pannes (1h)
BATTERY_LOW_THR      = 0.10
BATTERY_CRIT_THR     = 0.05
MONGO_FLUSH_INTERVAL = 60      # secondes entre deux flushes périodiques
MONGO_COLLECTION     = "kafka_kpi_snapshots"
MONGO_SESSIONS_COL   = "kafka_sessions"
MONGO_OP_STATS_COL   = "kafka_operator_stats"
RECORDING_WINDOW     = 200     # dernières N durées pour la moyenne glissante


# ── Internal state ────────────────────────────────────────────────────────────

_lock = threading.Lock()

# -- Recording counters (reset chaque jour)
_recording: dict = {
    "today":    None,   # str "YYYY-MM-DD"
    "started":  0,
    "stopped":  0,
    "failed":   0,
    "durations": deque(maxlen=RECORDING_WINDOW),
    # station_id → {"ts": float, "operator": str, "scenario": str}
    "active": {},
}

# -- Sessions in-memory (session_id → dict)
# Une session est créée à recording_stopped.
# upload_status : "pending" | "uploaded"
_sessions: dict[str, dict] = {}

# -- Operator stats in-memory
# operator → {
#   "by_day":  { "YYYY-MM-DD" → {"sessions": int, "duration_s": float, "failed": int} }
#   "by_hour": { hour_int     → {"sessions": int, "duration_s": float} }
#   "by_month":{ "YYYY-MM"    → {"sessions": int, "duration_s": float, "failed": int} }
#   "total_sessions": int, "total_duration_s": float, "total_failed": int
# }
_operator_stats: dict[str, dict] = {}

# -- Upload
_upload: dict = {
    "completed":   0,
    "failed":      0,
    "queued":      0,
    "in_progress": 0,
    "elapsed_s":   deque(maxlen=100),
    "error_counts": defaultdict(int),
}

# -- Device faults
_device: dict = {
    "active_faults":    {},
    "fault_ts_window":  deque(),
}

# -- Trackers
_trackers: dict = {
    "states":              {},
    "low_battery_events":  0,
    "crit_battery_events": 0,
}

# -- Stations
_stations: dict = {
    "states": {},
}

_event_counter: dict = defaultdict(int)
_last_flush_ts: float = 0.0
_flush_thread: threading.Thread | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_today() -> None:
    today = date.today().isoformat()
    if _recording["today"] != today:
        _recording["today"]   = today
        _recording["started"] = 0
        _recording["stopped"] = 0
        _recording["failed"]  = 0


def _ts_to_parts(ts: float) -> tuple[str, int, str]:
    """Return (date_iso, hour, month_iso) from a unix timestamp."""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.date().isoformat(), dt.hour, dt.strftime("%Y-%m")


def _accum_operator(operator: str, duration_s: float, failed: bool, ts: float) -> None:
    """Accumulate duration/session into operator stats (called under lock)."""
    if not operator:
        return
    day, hour, month = _ts_to_parts(ts)

    op = _operator_stats.setdefault(operator, {
        "by_day":   {},
        "by_hour":  {},
        "by_month": {},
        "total_sessions":   0,
        "total_duration_s": 0.0,
        "total_failed":     0,
    })

    # by_day
    d = op["by_day"].setdefault(day, {"sessions": 0, "duration_s": 0.0, "failed": 0})
    d["sessions"]   += 1
    d["duration_s"] += duration_s
    if failed:
        d["failed"] += 1

    # by_hour
    h = op["by_hour"].setdefault(hour, {"sessions": 0, "duration_s": 0.0})
    h["sessions"]   += 1
    h["duration_s"] += duration_s

    # by_month
    m = op["by_month"].setdefault(month, {"sessions": 0, "duration_s": 0.0, "failed": 0})
    m["sessions"]   += 1
    m["duration_s"] += duration_s
    if failed:
        m["failed"] += 1

    op["total_sessions"]   += 1
    op["total_duration_s"] += duration_s
    if failed:
        op["total_failed"] += 1


# ── Public entry point ────────────────────────────────────────────────────────

def on_event(msg: dict) -> None:
    event_type = msg.get("type", "")
    if not event_type:
        return

    with _lock:
        _event_counter[event_type] += 1
        _ensure_today()
        _dispatch(event_type, msg)

    if event_type in ("recording_stopped", "upload_completed", "upload_failed",
                      "session_integrity_error", "device_fault"):
        _schedule_flush(trigger=event_type)


def _dispatch(event_type: str, msg: dict) -> None:
    station_id = str(msg.get("station_id", ""))
    ts = float(msg.get("ts", time.time()))

    # Station presence
    if station_id:
        st = _stations["states"].setdefault(station_id, {
            "operator": "", "connected": True, "alert": False, "last_ts": 0.0
        })
        st["last_ts"]  = ts
        st["operator"] = msg.get("operator", "") or st["operator"]

    # ── salle.station.events ──────────────────────────────────────────────────
    if event_type == "operator_connected":
        if station_id:
            _stations["states"][station_id]["connected"] = True
            _stations["states"][station_id]["operator"]  = msg.get("operator", "")

    elif event_type in ("app_closed", "station_disconnected"):
        if station_id:
            _stations["states"][station_id]["connected"] = False

    elif event_type == "station_alert":
        if station_id:
            _stations["states"][station_id]["alert"] = bool(msg.get("active", False))

    # ── salle.recording.events ────────────────────────────────────────────────
    elif event_type == "recording_started":
        _recording["started"] += 1
        if station_id:
            _recording["active"][station_id] = {
                "ts":       ts,
                "operator": msg.get("operator", ""),
                "scenario": msg.get("scenario", ""),
            }

    elif event_type == "recording_stopped":
        _recording["stopped"] += 1
        duration_s = float(msg.get("duration_s", 0.0))
        failed     = bool(msg.get("failed", False))
        operator   = msg.get("operator", "")
        scenario   = msg.get("scenario", "")
        session_id = msg.get("session_id", "")

        if failed:
            _recording["failed"] += 1
        if duration_s > 0:
            _recording["durations"].append(duration_s)

        # Récupère l'opérateur depuis l'état actif si absent dans le message
        if not operator and station_id in _recording["active"]:
            operator = _recording["active"][station_id].get("operator", "")
        if not scenario and station_id in _recording["active"]:
            scenario = _recording["active"][station_id].get("scenario", "")

        _recording["active"].pop(station_id, None)

        # Crée/met à jour la session en mémoire
        sid = session_id or f"{station_id}_{int(ts)}"
        _sessions[sid] = {
            "session_id":     sid,
            "station_id":     station_id,
            "operator":       operator,
            "scenario":       scenario,
            "ts_stop":        ts,
            "duration_s":     duration_s,
            "failed":         failed,
            "upload_status":  "pending",   # reste "pending" tant que pas uploadé
            "size_gb":        None,
            "date":           _ts_to_parts(ts)[0],
            "hour":           _ts_to_parts(ts)[1],
            "month":          _ts_to_parts(ts)[2],
        }

        # Accumule dans les stats opérateur
        _accum_operator(operator, duration_s, failed, ts)

        # Persiste en Mongo (non-bloquant)
        _persist_session_async(_sessions[sid].copy())
        _persist_operator_stats_async(operator)

    elif event_type == "session_failed":
        _recording["failed"] += 1
        rec = _recording["active"].pop(station_id, {})
        operator = msg.get("operator", "") or rec.get("operator", "")
        ts_start = rec.get("ts", ts)
        duration_s = max(0.0, ts - ts_start)
        _accum_operator(operator, duration_s, True, ts)

    # ── salle.upload.events ───────────────────────────────────────────────────
    elif event_type == "upload_queued":
        _upload["queued"] = max(0, int(msg.get("pending_count", 0)))

    elif event_type == "upload_started":
        _upload["in_progress"] = max(0, _upload["in_progress"] + 1)

    elif event_type == "upload_completed":
        _upload["completed"]   += 1
        _upload["in_progress"]  = max(0, _upload["in_progress"] - 1)
        elapsed = float(msg.get("elapsed_s", 0.0))
        if elapsed > 0:
            _upload["elapsed_s"].append(elapsed)

        # Marque la session comme uploadée
        session_id = msg.get("session_id", "")
        if session_id and session_id in _sessions:
            _sessions[session_id]["upload_status"] = "uploaded"
            _persist_session_async(_sessions[session_id].copy())

    elif event_type == "upload_failed":
        _upload["failed"]      += 1
        _upload["in_progress"]  = max(0, _upload["in_progress"] - 1)
        err = str(msg.get("error", ""))[:120]
        if err:
            _upload["error_counts"][err] += 1

    # ── salle.device.events ───────────────────────────────────────────────────
    elif event_type == "device_fault":
        device    = msg.get("device", "")
        device_id = str(msg.get("device_id", ""))
        fault     = msg.get("fault", "")
        fault_key = f"{station_id}:{device}/{device_id}"

        if fault == "" or fault == "recovered":
            _device["active_faults"].pop(fault_key, None)
        else:
            _device["active_faults"][fault_key] = {
                "station_id": station_id,
                "device":     device,
                "device_id":  device_id,
                "fault":      fault,
                "detail":     msg.get("detail", ""),
                "ts":         ts,
            }
            _device["fault_ts_window"].append(ts)

        cutoff = time.time() - FAULT_WINDOW_S
        while _device["fault_ts_window"] and _device["fault_ts_window"][0] < cutoff:
            _device["fault_ts_window"].popleft()

    # ── salle.tracker.events ──────────────────────────────────────────────────
    elif event_type == "tracker_connected":
        key = (station_id, str(msg.get("idx", "")))
        _trackers["states"][key] = {
            "connected": True, "tracking": True,
            "serial": msg.get("serial", ""), "battery": None,
        }

    elif event_type == "tracker_disconnected":
        key = (station_id, str(msg.get("idx", "")))
        _trackers["states"].pop(key, None)

    elif event_type == "tracker_lost":
        key = (station_id, str(msg.get("idx", "")))
        if key in _trackers["states"]:
            _trackers["states"][key]["tracking"] = False

    elif event_type == "tracker_recovered":
        key = (station_id, str(msg.get("idx", "")))
        if key in _trackers["states"]:
            _trackers["states"][key]["tracking"] = True

    elif event_type in ("tracker_low_battery", "tracker_critical_battery"):
        key = (station_id, str(msg.get("idx", "")))
        battery = float(msg.get("battery", 0.0))
        _trackers["states"].setdefault(key, {
            "connected": True, "tracking": False, "serial": "", "battery": None,
        })["battery"] = battery
        if event_type == "tracker_low_battery":
            _trackers["low_battery_events"] += 1
        else:
            _trackers["crit_battery_events"] += 1


# ── Snapshot computation ──────────────────────────────────────────────────────

def get_snapshot() -> dict:
    with _lock:
        return _compute_snapshot()


def get_operator_stats() -> dict:
    """Return a copy of all operator stats (thread-safe)."""
    with _lock:
        # Sérialise les clés tuple (station, idx) en str pour JSON
        result = {}
        for op, data in _operator_stats.items():
            result[op] = {
                "by_day":          {k: dict(v) for k, v in data["by_day"].items()},
                "by_hour":         {str(k): dict(v) for k, v in data["by_hour"].items()},
                "by_month":        {k: dict(v) for k, v in data["by_month"].items()},
                "total_sessions":   data["total_sessions"],
                "total_duration_s": data["total_duration_s"],
                "total_duration_h": round(data["total_duration_s"] / 3600, 2),
                "total_failed":     data["total_failed"],
            }
        return result


def get_sessions_snapshot() -> list[dict]:
    """Return list of all in-memory sessions (thread-safe)."""
    with _lock:
        return list(_sessions.values())


def get_pending_sessions() -> list[dict]:
    """Sessions enregistrées mais pas encore uploadées."""
    with _lock:
        return [s for s in _sessions.values() if s.get("upload_status") == "pending"]


def _compute_snapshot() -> dict:
    now = time.time()

    durations = list(_recording["durations"])
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None
    total_attempts = _recording["started"]
    active_recording = len(_recording["active"])

    total_upload_attempts = _upload["completed"] + _upload["failed"]
    upload_success_rate = (
        round(_upload["completed"] / total_upload_attempts * 100, 1)
        if total_upload_attempts > 0 else None
    )
    elapsed_list = list(_upload["elapsed_s"])
    avg_upload_s = round(sum(elapsed_list) / len(elapsed_list), 1) if elapsed_list else None

    active_faults = list(_device["active_faults"].values())
    faults_by_device: dict[str, int] = defaultdict(int)
    for f in active_faults:
        faults_by_device[f["device"]] += 1

    fault_freq_1h = len(_device["fault_ts_window"])

    tracker_states = list(_trackers["states"].values())
    n_trackers     = len(tracker_states)
    n_tracking     = sum(1 for t in tracker_states if t.get("tracking"))
    n_low_bat      = sum(
        1 for t in tracker_states
        if t.get("battery") is not None and t["battery"] <= BATTERY_LOW_THR
    )
    tracker_availability = (
        round(n_tracking / n_trackers * 100, 1) if n_trackers > 0 else None
    )

    station_list = list(_stations["states"].values())
    n_connected  = sum(1 for s in station_list if s.get("connected"))
    n_alert      = sum(1 for s in station_list if s.get("alert"))
    n_operators  = sum(1 for s in station_list if s.get("connected") and s.get("operator"))

    recording_fail_rate = (
        round(_recording["failed"] / total_attempts * 100, 1)
        if total_attempts > 0 else None
    )

    # Sessions summary
    all_sessions   = list(_sessions.values())
    pending_upload = sum(1 for s in all_sessions if s.get("upload_status") == "pending")
    uploaded       = sum(1 for s in all_sessions if s.get("upload_status") == "uploaded")
    total_dur_h    = round(sum(s.get("duration_s", 0) for s in all_sessions) / 3600, 2)

    # Operator leaderboard (total sessions desc)
    op_leaderboard = sorted(
        [
            {
                "operator":     op,
                "sessions":     d["total_sessions"],
                "duration_h":   round(d["total_duration_s"] / 3600, 2),
                "failed":       d["total_failed"],
            }
            for op, d in _operator_stats.items()
        ],
        key=lambda x: x["sessions"],
        reverse=True,
    )[:20]

    return {
        "ts":     now,
        "ts_iso": datetime.now(timezone.utc).isoformat(),
        "date":   _recording.get("today") or date.today().isoformat(),

        "recording": {
            "started_today":    _recording["started"],
            "stopped_today":    _recording["stopped"],
            "failed_today":     _recording["failed"],
            "active_now":       active_recording,
            "avg_duration_s":   avg_duration,
            "fail_rate_pct":    recording_fail_rate,
            "total_duration_s": round(sum(durations), 1),
            "total_duration_h": round(sum(durations) / 3600, 2),
        },

        "sessions": {
            "total_seen":         len(all_sessions),
            "pending_upload":     pending_upload,
            "uploaded":           uploaded,
            "total_duration_h":   total_dur_h,
        },

        "operators_leaderboard": op_leaderboard,

        "upload": {
            "completed_total":  _upload["completed"],
            "failed_total":     _upload["failed"],
            "queued_now":       _upload["queued"],
            "in_progress_now":  _upload["in_progress"],
            "success_rate_pct": upload_success_rate,
            "avg_elapsed_s":    avg_upload_s,
            "top_errors":       dict(
                sorted(_upload["error_counts"].items(),
                       key=lambda x: x[1], reverse=True)[:5]
            ),
        },

        "device_faults": {
            "active_count":       len(active_faults),
            "by_device_type":     dict(faults_by_device),
            "fault_frequency_1h": fault_freq_1h,
            "active_faults":      active_faults,
        },

        "trackers": {
            "total_connected":          n_trackers,
            "tracking_now":             n_tracking,
            "availability_pct":         tracker_availability,
            "low_battery_now":          n_low_bat,
            "low_battery_events_total": _trackers["low_battery_events"],
            "crit_battery_events_total":_trackers["crit_battery_events"],
        },

        "stations": {
            "total_seen":       len(station_list),
            "connected_now":    n_connected,
            "with_operator_now":n_operators,
            "with_alert_now":   n_alert,
        },

        "event_counts": dict(_event_counter),
    }


# ── MongoDB persistence ───────────────────────────────────────────────────────

def _get_col(collection: str):
    from pymongo import MongoClient
    from config import MONGODB_URI
    return MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)["physical_data"][collection]


def _persist_session_async(session: dict) -> None:
    """Upsert session document in MongoDB (daemon thread)."""
    def _run():
        try:
            col = _get_col(MONGO_SESSIONS_COL)
            sid = session["session_id"]
            col.replace_one({"_id": sid}, {"_id": sid, **session}, upsert=True)
        except Exception as e:
            logger.warning("kafka_kpi_engine: session persist failed — %s", e)
    threading.Thread(target=_run, daemon=True).start()


def _persist_operator_stats_async(operator: str) -> None:
    """
    Upsert today's operator stats document in MongoDB.
    Key: operator + date  →  collection kafka_operator_stats
    """
    if not operator:
        return

    def _run():
        try:
            with _lock:
                op_data = _operator_stats.get(operator)
                if not op_data:
                    return
                today = date.today().isoformat()
                day_data = op_data["by_day"].get(today, {})

            doc_id  = f"{operator}_{today}"
            col     = _get_col(MONGO_OP_STATS_COL)
            col.replace_one(
                {"_id": doc_id},
                {
                    "_id":        doc_id,
                    "operator":   operator,
                    "date":       today,
                    "month":      today[:7],
                    "sessions":   day_data.get("sessions", 0),
                    "duration_s": day_data.get("duration_s", 0.0),
                    "duration_h": round(day_data.get("duration_s", 0.0) / 3600, 3),
                    "failed":     day_data.get("failed", 0),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning("kafka_kpi_engine: operator stats persist failed — %s", e)

    threading.Thread(target=_run, daemon=True).start()


def _flush_to_mongo(trigger: str = "periodic") -> None:
    global _last_flush_ts
    try:
        snapshot = get_snapshot()
        doc = {
            "ts":      snapshot["ts"],
            "ts_iso":  snapshot["ts_iso"],
            "trigger": trigger,
            "kpis":    snapshot,
        }
        _get_col(MONGO_COLLECTION).insert_one(doc)
        _last_flush_ts = time.time()
        logger.debug("kafka_kpi_engine: flushed snapshot (trigger=%s)", trigger)
    except Exception as e:
        logger.warning("kafka_kpi_engine: mongo flush failed — %s", e)


def _schedule_flush(trigger: str) -> None:
    threading.Thread(
        target=_flush_to_mongo,
        args=(trigger,),
        daemon=True,
        name=f"kafka-kpi-flush-{trigger}",
    ).start()


def _periodic_flush_loop() -> None:
    while True:
        time.sleep(MONGO_FLUSH_INTERVAL)
        _flush_to_mongo("periodic")


def start_flush_thread() -> None:
    global _flush_thread
    if _flush_thread and _flush_thread.is_alive():
        return
    _flush_thread = threading.Thread(
        target=_periodic_flush_loop,
        name="kafka-kpi-periodic-flush",
        daemon=True,
    )
    _flush_thread.start()
    logger.info("kafka_kpi_engine: periodic flush thread started (interval=%ds)",
                MONGO_FLUSH_INTERVAL)
