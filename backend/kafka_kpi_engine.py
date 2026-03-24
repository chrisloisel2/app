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

Structure MongoDB : collection `kafka_kpi_snapshots`
  {
    "ts":         float,       # time.time()
    "ts_iso":     str,         # ISO 8601
    "trigger":    str,         # "periodic" | event type
    "kpis":       { ... }      # snapshot complet
  }
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

FAULT_WINDOW_S      = 3600    # fenêtre glissante pour fréquence de pannes (1h)
BATTERY_LOW_THR     = 0.10    # seuil batterie faible
BATTERY_CRIT_THR    = 0.05    # seuil batterie critique
MONGO_FLUSH_INTERVAL = 60     # secondes entre deux flushes périodiques
MONGO_COLLECTION    = "kafka_kpi_snapshots"
RECORDING_WINDOW    = 200     # dernières N durées pour la moyenne glissante


# ── Internal state ────────────────────────────────────────────────────────────

_lock = threading.Lock()

# -- Recording
_recording: dict = {
    # today_date (str ISO) → compteurs du jour
    "today":   None,   # str "YYYY-MM-DD"
    "started":  0,
    "stopped":  0,
    "failed":   0,
    # Durées des N derniers enregistrements (secondes)
    "durations": deque(maxlen=RECORDING_WINDOW),
    # Sessions actives station_id → ts de démarrage
    "active": {},
}

# -- Upload
_upload: dict = {
    "completed":  0,
    "failed":     0,
    "queued":     0,   # nb actuellement en queue
    "in_progress": 0,  # nb en cours d'envoi
    "elapsed_s":  deque(maxlen=100),   # durées d'upload réussies
    "error_counts": defaultdict(int),  # error substring → count
}

# -- Device faults
_device: dict = {
    # fault_key → {"device", "device_id", "fault", "ts", "station_id"}
    "active_faults": {},
    # timestamps des pannes sur la fenêtre glissante
    "fault_ts_window": deque(),   # deque de floats
}

# -- Trackers
_trackers: dict = {
    # (station_id, idx) → {"connected": bool, "tracking": bool, "battery": float|None}
    "states": {},
    "low_battery_events":  0,
    "crit_battery_events": 0,
}

# -- Stations
_stations: dict = {
    # station_id → {"operator": str, "connected": bool, "alert": bool, "last_ts": float}
    "states": {},
}

# -- Global event counter (for activity monitoring)
_event_counter: dict = defaultdict(int)

# -- Mongo flush control
_last_flush_ts: float = 0.0
_flush_thread: threading.Thread | None = None
_flush_triggers: deque = deque()   # event types that trigger immediate flush


# ── Day reset ─────────────────────────────────────────────────────────────────

def _ensure_today() -> None:
    """Reset daily counters if the date has changed (called under lock)."""
    today = date.today().isoformat()
    if _recording["today"] != today:
        _recording["today"]   = today
        _recording["started"] = 0
        _recording["stopped"] = 0
        _recording["failed"]  = 0


# ── Public entry point ────────────────────────────────────────────────────────

def on_event(msg: dict) -> None:
    """
    Called for every KafkaEventPublisher event received.
    Updates in-memory state and optionally triggers a Mongo flush.
    """
    event_type = msg.get("type", "")
    if not event_type:
        return

    with _lock:
        _event_counter[event_type] += 1
        _ensure_today()
        _dispatch(event_type, msg)

    # Flush Mongo on high-value events (non-blocking)
    if event_type in ("recording_stopped", "upload_completed", "upload_failed",
                      "session_integrity_error", "device_fault"):
        _schedule_flush(trigger=event_type)


def _dispatch(event_type: str, msg: dict) -> None:
    """Route event to the appropriate accumulator (called under lock)."""

    station_id = str(msg.get("station_id", ""))
    ts = float(msg.get("ts", time.time()))

    # ── Station presence ──────────────────────────────────────────────────────
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
            _recording["active"][station_id] = ts

    elif event_type == "recording_stopped":
        _recording["stopped"] += 1
        duration = float(msg.get("duration_s", 0.0))
        if duration > 0:
            _recording["durations"].append(duration)
        if msg.get("failed"):
            _recording["failed"] += 1
        _recording["active"].pop(station_id, None)

    elif event_type == "session_failed":
        _recording["failed"] += 1
        _recording["active"].pop(station_id, None)

    # ── salle.upload.events ───────────────────────────────────────────────────
    elif event_type == "upload_queued":
        _upload["queued"] = max(0, int(msg.get("pending_count", 0)))

    elif event_type == "upload_started":
        _upload["in_progress"] = max(0, _upload["in_progress"] + 1)

    elif event_type == "upload_completed":
        _upload["completed"] += 1
        _upload["in_progress"] = max(0, _upload["in_progress"] - 1)
        elapsed = float(msg.get("elapsed_s", 0.0))
        if elapsed > 0:
            _upload["elapsed_s"].append(elapsed)

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

        # Purge fenêtre glissante
        cutoff = time.time() - FAULT_WINDOW_S
        while _device["fault_ts_window"] and _device["fault_ts_window"][0] < cutoff:
            _device["fault_ts_window"].popleft()

    # ── salle.tracker.events ──────────────────────────────────────────────────
    elif event_type == "tracker_connected":
        key = (station_id, str(msg.get("idx", "")))
        _trackers["states"][key] = {
            "connected": True, "tracking": True,
            "serial": msg.get("serial", ""),
            "battery": None,
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
        if key in _trackers["states"]:
            _trackers["states"][key]["battery"] = battery
        else:
            _trackers["states"][key] = {
                "connected": True, "tracking": False,
                "serial": "", "battery": battery,
            }
        if event_type == "tracker_low_battery":
            _trackers["low_battery_events"] += 1
        else:
            _trackers["crit_battery_events"] += 1


# ── Snapshot computation ──────────────────────────────────────────────────────

def get_snapshot() -> dict:
    """Return a fully computed KPI snapshot (thread-safe, read-only copy)."""
    with _lock:
        return _compute_snapshot()


def _compute_snapshot() -> dict:
    """Must be called under _lock."""
    now = time.time()

    # Recording
    durations = list(_recording["durations"])
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None
    total_attempts = _recording["started"]

    # Sessions currently recording
    active_recording = len(_recording["active"])

    # Upload
    total_upload_attempts = _upload["completed"] + _upload["failed"]
    upload_success_rate = (
        round(_upload["completed"] / total_upload_attempts * 100, 1)
        if total_upload_attempts > 0 else None
    )
    elapsed_list = list(_upload["elapsed_s"])
    avg_upload_s = round(sum(elapsed_list) / len(elapsed_list), 1) if elapsed_list else None

    # Device faults
    active_faults = list(_device["active_faults"].values())
    faults_by_device: dict[str, int] = defaultdict(int)
    for f in active_faults:
        faults_by_device[f["device"]] += 1

    fault_freq_1h = len(_device["fault_ts_window"])

    # Trackers
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

    # Stations
    station_list = list(_stations["states"].values())
    n_connected  = sum(1 for s in station_list if s.get("connected"))
    n_alert      = sum(1 for s in station_list if s.get("alert"))
    n_operators  = sum(1 for s in station_list if s.get("connected") and s.get("operator"))

    # Failure rate
    recording_fail_rate = (
        round(_recording["failed"] / total_attempts * 100, 1)
        if total_attempts > 0 else None
    )

    return {
        "ts":     now,
        "ts_iso": datetime.now(timezone.utc).isoformat(),
        "date":   _recording.get("today") or date.today().isoformat(),

        "recording": {
            "started_today":        _recording["started"],
            "stopped_today":        _recording["stopped"],
            "failed_today":         _recording["failed"],
            "active_now":           active_recording,
            "avg_duration_s":       avg_duration,
            "fail_rate_pct":        recording_fail_rate,
            "total_duration_s":     round(sum(durations), 1),
        },

        "upload": {
            "completed_total":      _upload["completed"],
            "failed_total":         _upload["failed"],
            "queued_now":           _upload["queued"],
            "in_progress_now":      _upload["in_progress"],
            "success_rate_pct":     upload_success_rate,
            "avg_elapsed_s":        avg_upload_s,
            "top_errors":           dict(
                sorted(_upload["error_counts"].items(),
                       key=lambda x: x[1], reverse=True)[:5]
            ),
        },

        "device_faults": {
            "active_count":         len(active_faults),
            "by_device_type":       dict(faults_by_device),
            "fault_frequency_1h":   fault_freq_1h,
            "active_faults":        active_faults,
        },

        "trackers": {
            "total_connected":      n_trackers,
            "tracking_now":         n_tracking,
            "availability_pct":     tracker_availability,
            "low_battery_now":      n_low_bat,
            "low_battery_events_total":   _trackers["low_battery_events"],
            "crit_battery_events_total":  _trackers["crit_battery_events"],
        },

        "stations": {
            "total_seen":           len(station_list),
            "connected_now":        n_connected,
            "with_operator_now":    n_operators,
            "with_alert_now":       n_alert,
        },

        "event_counts": dict(_event_counter),
    }


# ── MongoDB ingestion ─────────────────────────────────────────────────────────

def _get_mongo_collection():
    from pymongo import MongoClient
    from config import MONGODB_URI
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
    return client["physical_data"][MONGO_COLLECTION]


def _flush_to_mongo(trigger: str = "periodic") -> None:
    """Write current snapshot to MongoDB. Silently ignores errors."""
    global _last_flush_ts
    try:
        snapshot = get_snapshot()
        doc = {
            "ts":      snapshot["ts"],
            "ts_iso":  snapshot["ts_iso"],
            "trigger": trigger,
            "kpis":    snapshot,
        }
        col = _get_mongo_collection()
        col.insert_one(doc)
        _last_flush_ts = time.time()
        logger.debug("kafka_kpi_engine: flushed to mongo (trigger=%s)", trigger)
    except Exception as e:
        logger.warning("kafka_kpi_engine: mongo flush failed — %s", e)


def _schedule_flush(trigger: str) -> None:
    """Trigger a non-blocking Mongo flush in a daemon thread."""
    t = threading.Thread(
        target=_flush_to_mongo,
        args=(trigger,),
        daemon=True,
        name=f"kafka-kpi-flush-{trigger}",
    )
    t.start()


def _periodic_flush_loop() -> None:
    """Background thread: flush to Mongo every MONGO_FLUSH_INTERVAL seconds."""
    while True:
        time.sleep(MONGO_FLUSH_INTERVAL)
        _flush_to_mongo("periodic")


def start_flush_thread() -> None:
    """Start the periodic Mongo flush background thread (idempotent)."""
    global _flush_thread
    if _flush_thread and _flush_thread.is_alive():
        return
    _flush_thread = threading.Thread(
        target=_periodic_flush_loop,
        name="kafka-kpi-periodic-flush",
        daemon=True,
    )
    _flush_thread.start()
    logger.info("kafka_kpi_engine: periodic Mongo flush thread started (interval=%ds)",
                MONGO_FLUSH_INTERVAL)
