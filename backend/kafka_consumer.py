"""
Kafka consumer for monitoring (KAFKA_SALLE_TOPIC).

KafkaEventPublisher — messages plats (tous les champs au niveau racine) :
  {
    "type": "<event_type>", "station_id": "PC-03", "ts": 1741234567.123,
    "operator": "alice", "scenario": "scenario-A",
    ... champs spécifiques à l'événement ...
  }

Types d'événements :
  operator_connected, app_closed, station_disconnected, station_alert,
  cameras_detected,
  gripper_connected, gripper_disconnected, gripper_switch_on, gripper_switch_off,
  session_failed,
  tracker_connected, tracker_disconnected, tracker_lost,
  tracker_recovered, tracker_low_battery, tracker_critical_battery,
  recording_started, recording_stopped,
  upload_queued, upload_started, upload_completed, upload_failed
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── In-memory state ───────────────────────────────────────────────────────────

# SalleReporter state (keyed by pc_id int)
_state = {
    "pcs": {},         # pc_id (int) -> PC state dict
    "last_update": None,
    "connected": False,
    "errors": [],
}

# KafkaEventPublisher state (keyed by station_id str, e.g. "PC-03")
# station_id -> {
#   "station_id", "operator", "scenario",
#   "cameras": [...], "pinces": {"left": {...}, "right": {...}},
#   "trackers": {idx -> {...}},
#   "recording": {"is_recording": bool, "duration_s": float, "trigger": str,
#                 "last_start_ts": float, "last_activity_ts": float},
#   "connected": bool,  # False après app_closed
#   "last_ts": float,
# }
_stations = {}

_pc_ever_seen: set = set()
_state_lock = threading.Lock()
_consumer_thread = None

PRESENCE_TIMEOUT_S = 30.0  # station marquée déconnectée si silencieuse > 30 s
SPOOL_HISTORY_MAX  = 20    # nombre de sessions terminées conservées

# inspect_session state
# active_sessions: session_id -> {
#   "session_id", "step", "status", "ts",
#   "inspection": {"ok": bool|None, "total_checks": int, "errors": []},
#   "upload": {"file_index": int, "file_total": int, "rel": str,
#              "speed_mbps": float, "files_uploaded": int, "total_mb": float},
#   "pipeline_status": str,  # dernière valeur de pipeline/status
# }
# history: liste des sessions terminées (pipeline/completed ou nacked), max 20
_spool = {
    "active":        {},   # session_id -> dict (ancien format, conservé)
    "history":       [],   # liste chronologique inversée (plus récent en tête)
    "consumer_ok":   False,
    "last_ts":       None,
    "processed_total":  0,
    "failed_total":     0,
    # Nouveau format spool_status — remplacé à chaque message
    "snapshot":      None,
    # spool_daemon lifecycle — dernier event reçu de run.sh
    "daemon":        None,  # {"status": "started"|"stopped"|"start_failed", "pid": int|None, "ts": float, "ts_iso": str, "workers": int|None, "nas_host": str|None, "log": str|None}
}

# session_integrity_error alerts — keyed by station_id
# station_id -> list of alert dicts (most recent first, max 10)
_integrity_alerts: dict = {}
INTEGRITY_ALERTS_MAX = 10


def _get_bootstrap_server():
    from config import KAFKA_BROKER, KAFKA_BROKER_PORT
    return f"{KAFKA_BROKER}:{KAFKA_BROKER_PORT}"


def _notify_ws():
    """Push state to all WebSocket clients."""
    try:
        from routes.salle import notify_ws
        notify_ws()
    except Exception:
        pass


# ── SalleReporter handler ─────────────────────────────────────────────────────

def _handle_salle_reporter(msg: dict, now: str):
    """Process a SalleReporter message (source == 'pc')."""
    pc_id = int(msg.get("pc_id", 0))
    if not (1 <= pc_id <= 30):
        return False

    _pc_ever_seen.add(pc_id)
    prev = _state["pcs"].get(pc_id, {})

    if msg.get("disconnected"):
        new_state = {
            "pc_id": pc_id,
            "hostname": msg.get("hostname") or prev.get("hostname") or f"PC-{pc_id:05d}",
            "operator_username": prev.get("operator_username"),
            "is_recording": False,
            "has_alert": False,
            "sqlite_queue": prev.get("sqlite_queue"),
            "last_send": prev.get("last_send"),
            "_disconnected": True,
            "last_seen_at": prev.get("last_seen_at"),
        }
    else:
        new_state = {
            "pc_id": pc_id,
            "hostname": msg.get("hostname") or prev.get("hostname") or f"PC-{pc_id:05d}",
            "operator_username": msg.get("operator_username") or None,
            "is_recording": bool(msg.get("is_recording")),
            "has_alert": bool(msg.get("has_alert")),
            "sqlite_queue": msg.get("sqlite_queue"),
            "last_send": msg.get("last_send"),
            "_disconnected": False,
            "last_seen_at": now,
        }

    _state["pcs"][pc_id] = new_state
    return True


# ── KafkaEventPublisher handler ───────────────────────────────────────────────

def _default_station(station_id: str) -> dict:
    return {
        "station_id": station_id,
        "operator":   "",
        "scenario":   "",
        "alert":      False,
        "cameras":    [],
        "grippers": {
            "left":  {"connected": False, "port": None},
            "right": {"connected": False, "port": None},
        },
        "trackers": {},   # idx (str) -> {idx, serial, tracking, battery}
        "recording": {
            "is_recording": False,
            "duration_s":   0.0,
            "trigger":      None,
            "failed":       False,
            "last_start_ts":    0.0,
            "last_activity_ts": 0.0,
        },
        "upload": None,          # None ou {status, session_id, ...}
        "device_faults": {},     # fault_key -> fault dict
        "connected": True,
        "last_ts":   0.0,
    }


def _handle_event(msg: dict) -> bool:
    """Process a KafkaEventPublisher message (has 'type' field).
    All fields are at root level (flat format per kafka_norme.md).
    Returns True if state changed (triggers WS push).
    """
    event_type = msg.get("type", "")
    station_id = str(msg.get("station_id", "")).strip()
    if not station_id:
        return False

    ts       = float(msg.get("ts", time.time()))
    operator = str(msg.get("operator", ""))
    scenario = str(msg.get("scenario", ""))

    # Events qui prouvent qu'une station est vivante → connexion implicite
    ACTIVITY_EVENTS = {
        "recording_started", "recording_stopped", "session_failed",
        "cameras_detected",
        "gripper_connected", "gripper_disconnected",
        "gripper_switch_on", "gripper_switch_off",
        "tracker_connected", "tracker_disconnected",
        "tracker_lost", "tracker_recovered",
        "tracker_low_battery", "tracker_critical_battery",
        "upload_queued", "upload_started", "upload_completed", "upload_failed",
        "device_fault",
    }

    st = _stations.get(station_id) or _default_station(station_id)
    st["last_ts"] = ts
    if operator:
        st["operator"] = operator
    if scenario:
        st["scenario"] = scenario

    if event_type in ACTIVITY_EVENTS and not st["connected"]:
        st["connected"] = True

    if event_type == "operator_connected":
        st["connected"] = True
        st["operator"] = operator
        st["scenario"] = scenario

    elif event_type in ("app_closed", "station_disconnected"):
        st["connected"] = False
        st["recording"]["is_recording"] = False

    elif event_type == "station_alert":
        st["alert"] = bool(msg.get("active", False))

    elif event_type == "cameras_detected":
        st["cameras"] = msg.get("cameras", [])
        # Nettoie les faults camera pour les caméras qui n'ont plus de fault
        faults = st.setdefault("device_faults", {})
        for cam in st["cameras"]:
            if not cam.get("fault"):
                faults.pop(f"camera/{cam.get('position', '')}", None)
        st["alert"] = len(faults) > 0

    elif event_type == "gripper_connected":
        side = msg.get("side", "right")
        st["grippers"][side] = {"connected": True, "port": msg.get("port")}
        faults = st.setdefault("device_faults", {})
        faults.pop(f"gripper/{side}", None)
        st["alert"] = len(faults) > 0

    elif event_type == "gripper_disconnected":
        side = msg.get("side", "right")
        st["grippers"][side] = {"connected": False, "port": None}

    elif event_type in ("gripper_switch_on", "gripper_switch_off"):
        # Informational only — no persistent state change needed
        pass

    elif event_type == "session_failed":
        st["recording"]["failed"] = True

    elif event_type == "tracker_connected":
        idx = str(msg.get("idx", ""))
        st["trackers"][idx] = {
            "idx": msg.get("idx"),
            "serial": msg.get("serial", ""),
            "tracking": True,
            "battery": st["trackers"].get(idx, {}).get("battery", 1.0),
        }
        faults = st.setdefault("device_faults", {})
        faults.pop(f"tracker/{idx}", None)
        st["alert"] = len(faults) > 0

    elif event_type == "tracker_disconnected":
        idx = str(msg.get("idx", ""))
        st["trackers"].pop(idx, None)

    elif event_type == "tracker_lost":
        idx = str(msg.get("idx", ""))
        if idx in st["trackers"]:
            st["trackers"][idx]["tracking"] = False

    elif event_type == "tracker_recovered":
        idx = str(msg.get("idx", ""))
        if idx in st["trackers"]:
            st["trackers"][idx]["tracking"] = True
        faults = st.setdefault("device_faults", {})
        faults.pop(f"tracker/{idx}", None)
        st["alert"] = len(faults) > 0

    elif event_type in ("tracker_low_battery", "tracker_critical_battery"):
        idx     = str(msg.get("idx", ""))
        battery = float(msg.get("battery", 0.0))
        if idx in st["trackers"]:
            st["trackers"][idx]["battery"] = battery
        else:
            st["trackers"][idx] = {
                "idx": msg.get("idx"),
                "serial": "",
                "tracking": False,
                "battery": battery,
            }

    elif event_type == "recording_started":
        now = time.time()
        st["recording"]["is_recording"] = True
        st["recording"]["trigger"]      = msg.get("trigger")
        st["recording"]["failed"]       = False
        st["recording"]["last_start_ts"]    = now
        st["recording"]["last_activity_ts"] = now

    elif event_type == "recording_stopped":
        now = time.time()
        st["recording"]["is_recording"] = False
        st["recording"]["duration_s"]   = float(msg.get("duration_s", 0.0))
        st["recording"]["failed"]       = bool(msg.get("failed", False))
        st["recording"]["last_activity_ts"] = now

    elif event_type == "upload_queued":
        st["upload"] = {
            "status":        "queued",
            "session_id":    msg.get("session_id"),
            "pending_count": int(msg.get("pending_count", 0)),
            "is_failed":     bool(msg.get("is_failed", False)),
            "error":         None,
        }

    elif event_type == "upload_started":
        st["upload"] = {
            "status":     "sending",
            "session_id": msg.get("session_id"),
            "error":      None,
        }

    elif event_type == "upload_completed":
        st["upload"] = {
            "status":     "success",
            "session_id": msg.get("session_id"),
            "records":    int(msg.get("records", 0)),
            "elapsed_s":  float(msg.get("elapsed_s", 0.0)),
            "error":      None,
        }

    elif event_type == "upload_failed":
        st["upload"] = {
            "status":     "failed",
            "session_id": msg.get("session_id"),
            "error":      msg.get("error", ""),
        }

    elif event_type == "device_fault":
        device    = msg.get("device", "")
        device_id = str(msg.get("device_id", ""))
        fault     = msg.get("fault", "")
        detail    = msg.get("detail", "")

        # Initialise le dict de pannes actives si nécessaire
        faults = st.setdefault("device_faults", {})
        fault_key = f"{device}/{device_id}"

        if fault == "recovered":
            # Supprime la panne
            faults.pop(fault_key, None)

            # Réconcilie l'état du périphérique
            if device == "gripper" and device_id in ("left", "right"):
                st["grippers"][device_id]["connected"] = True
            elif device == "tracker":
                idx = str(device_id).lstrip("T")
                if idx in st["trackers"]:
                    st["trackers"][idx]["tracking"] = True
            elif device == "camera":
                for cam in st["cameras"]:
                    if str(cam.get("position", "")) == device_id:
                        cam["fault"] = None
        else:
            # Enregistre / met à jour la panne
            faults[fault_key] = {
                "device":    device,
                "device_id": device_id,
                "fault":     fault,
                "detail":    detail,
                "ts":        ts,
            }

            # Réconcilie l'état du périphérique
            if device == "gripper" and device_id in ("left", "right"):
                st["grippers"][device_id]["connected"] = False
            elif device == "tracker":
                idx = str(device_id).lstrip("T")
                if fault == "disconnected":
                    st["trackers"].pop(idx, None)
                elif fault == "tracking_lost" and idx in st["trackers"]:
                    st["trackers"][idx]["tracking"] = False
            elif device == "camera":
                for cam in st["cameras"]:
                    if str(cam.get("position", "")) == device_id:
                        cam["fault"] = fault

        # Alerte station active ssi des pannes device_fault restent non résolues
        st["alert"] = len(faults) > 0

    elif event_type == "session_integrity_error":
        alert = {
            "ts":                    ts,
            "session_id":            msg.get("session_id", ""),
            "operator":              msg.get("operator", ""),
            "scenario":              msg.get("scenario", ""),
            "is_failed":             bool(msg.get("is_failed", False)),
            "issues":                list(msg.get("issues", [])),
            "warnings":              list(msg.get("warnings", [])),
            "cameras_found":         list(msg.get("cameras_found", [])),
            "cameras_missing_mp4":   list(msg.get("cameras_missing_mp4", [])),
            "cameras_missing_jsonl": list(msg.get("cameras_missing_jsonl", [])),
        }
        alerts = _integrity_alerts.get(station_id, [])
        alerts.insert(0, alert)
        _integrity_alerts[station_id] = alerts[:INTEGRITY_ALERTS_MAX]

    else:
        logger.debug("KafkaEventPublisher: unknown event type '%s'", event_type)
        _stations[station_id] = st
        return False

    _stations[station_id] = st
    return True


# ── inspect_session handler ───────────────────────────────────────────────────

def _handle_spool_daemon(msg: dict) -> bool:
    """Process a message from run.sh (source == 'spool_daemon').
    Returns True if state changed (triggers WS push).
    """
    step   = msg.get("step", "")
    status = msg.get("status", "")
    if step != "daemon":
        return False
    _spool["daemon"] = {
        "status":   status,
        "pid":      msg.get("pid"),
        "ts":       float(msg.get("ts", time.time())),
        "ts_iso":   msg.get("ts_iso"),
        "workers":  msg.get("workers"),
        "nas_host": msg.get("nas_host"),
        "log":      msg.get("log"),
    }
    return True


def _handle_inspect_session(msg: dict) -> bool:
    """Process a message from inspect_session (source == 'inspect_session').
    Returns True if state changed (triggers WS push).
    """
    step       = msg.get("step", "")
    status     = msg.get("status", "")
    session_id = msg.get("session_id", "") or ""
    ts         = float(msg.get("ts", time.time()))

    _spool["last_ts"] = ts

    # ── Consumer lifecycle ────────────────────────────────────────────────────
    if step == "consumer":
        if status == "started":
            _spool["consumer_ok"] = True
        elif status in ("pipeline_exception",):
            _spool["consumer_ok"] = True  # still running
        return True

    if not session_id:
        return False

    # ── Get or create active session entry ────────────────────────────────────
    sess = _spool["active"].get(session_id)
    if sess is None:
        sess = {
            "session_id":      session_id,
            "step":            step,
            "status":          status,
            "ts":              ts,
            "pipeline_status": "",
            "inspection":      {"ok": None, "total_checks": 0, "failed_checks": [], "errors": []},
            "upload":          {"file_index": 0, "file_total": 0, "rel": "",
                                "speed_mbps": 0.0, "files_uploaded": 0,
                                "total_mb": 0.0, "avg_speed_mbps": 0.0},
            "metadata":        None,
        }
        _spool["active"][session_id] = sess

    sess["step"]   = step
    sess["status"] = status
    sess["ts"]     = ts

    # ── Pipeline ──────────────────────────────────────────────────────────────
    if step == "pipeline":
        sess["pipeline_status"] = status
        if status == "inspection_passed":
            pass
        elif status == "inspection_failed":
            sess["inspection"]["ok"]            = False
            sess["inspection"]["errors"]        = msg.get("errors", [])
            sess["inspection"]["failed_checks"] = msg.get("failed_checks", [])
        elif status == "completed":
            sess["metadata"] = msg.get("metadata")
            _spool["processed_total"] += 1
            _finish_session(session_id, "ok")
            return True
        elif status in ("upload_failed", "quarantine_upload_failed"):
            _spool["failed_total"] += 1
            _finish_session(session_id, "upload_failed")
            return True

    # ── Inspection ────────────────────────────────────────────────────────────
    elif step == "inspection":
        if status == "completed":
            sess["inspection"]["ok"]            = bool(msg.get("ok", False))
            sess["inspection"]["total_checks"]  = int(msg.get("total_checks", 0))
            sess["inspection"]["failed_checks"] = msg.get("failed_checks", [])
            sess["inspection"]["errors"]        = msg.get("errors", [])
            sess["metadata"] = msg.get("metadata")

    # ── Upload file progress ──────────────────────────────────────────────────
    elif step == "upload":
        if status == "file_start":
            sess["upload"]["file_index"] = int(msg.get("file_index", 0))
            sess["upload"]["file_total"] = int(msg.get("file_total", 0))
            sess["upload"]["rel"]        = msg.get("rel", "")
        elif status == "file_done":
            sess["upload"]["file_index"]      = int(msg.get("file_index", 0))
            sess["upload"]["files_uploaded"]  = int(msg.get("file_index", 0)) + 1
            sess["upload"]["rel"]             = msg.get("rel", "")
            sess["upload"]["speed_mbps"]      = float(msg.get("speed_mbps", 0.0))
        elif status == "completed":
            sess["upload"]["files_uploaded"]  = int(msg.get("files_uploaded", 0))
            sess["upload"]["file_total"]      = int(msg.get("files_total", 0))
            sess["upload"]["total_mb"]        = float(msg.get("total_mb", 0.0))
            sess["upload"]["avg_speed_mbps"]  = float(msg.get("avg_speed_mbps", 0.0))

    # ── Consumer acked/nacked ─────────────────────────────────────────────────
    elif step == "consumer":
        if status == "message_acked":
            pass  # already handled by pipeline/completed
        elif status == "message_nacked":
            _spool["failed_total"] += 1
            _finish_session(session_id, "failed")
            return True

    return True


def _finish_session(session_id: str, outcome: str):
    """Move session from active to history."""
    sess = _spool["active"].pop(session_id, None)
    if sess is None:
        return
    sess["outcome"] = outcome
    _spool["history"].insert(0, sess)
    if len(_spool["history"]) > SPOOL_HISTORY_MAX:
        _spool["history"] = _spool["history"][:SPOOL_HISTORY_MAX]
    # Invalider le cache NAS pour cette session
    try:
        import cache_manager
        cache_manager.on_session_completed(session_id)
    except Exception:
        pass


def get_spool_snapshot() -> dict:
    """Snapshot of spool state — prioritise nouveau format spool_status."""
    with _state_lock:
        if _spool["snapshot"] is not None:
            return _spool["snapshot"]
        return {
            "consumer_ok":      _spool["consumer_ok"],
            "last_ts":          _spool["last_ts"],
            "processed_total":  _spool["processed_total"],
            "failed_total":     _spool["failed_total"],
            "active":           list(_spool["active"].values()),
            "history":          list(_spool["history"]),
        }


# ── Message dispatcher ────────────────────────────────────────────────────────

def _process_message(raw_value: bytes):
    try:
        msg = json.loads(raw_value.decode("utf-8"))
    except Exception as e:
        logger.warning("Kafka monitoring: invalid JSON — %s", e)
        return

    # Broadcast raw message to log viewers
    try:
        from routes.kafka_logs import broadcast
        broadcast("monitoring", msg)
    except Exception:
        pass

    should_notify = False
    now = datetime.now(timezone.utc).isoformat()

    with _state_lock:
        _state["last_update"] = now

        if "source" in msg and msg["source"] == "pc":
            # SalleReporter — état upload poste
            should_notify = _handle_salle_reporter(msg, now)
        elif "source" in msg and msg["source"] == "spool_status":
            # Nouveau format spool_status complet
            _spool["snapshot"] = msg
            _spool["last_ts"]  = msg.get("ts")
            _spool["consumer_ok"] = True
            should_notify = True
            # Si des sessions viennent d'être complétées, invalider le cache
            try:
                import cache_manager
                for item in msg.get("history", []):
                    sid = item.get("session_id", "")
                    if sid:
                        cache_manager.on_session_completed(sid)
            except Exception:
                pass
        elif "source" in msg and msg["source"] == "inspect_session":
            # inspect_session spool — pipeline d'inspection/upload (ancien format)
            should_notify = _handle_inspect_session(msg)
        elif "source" in msg and msg["source"] == "spool_daemon":
            # run.sh — lifecycle du daemon spool
            should_notify = _handle_spool_daemon(msg)
        elif "type" in msg:
            # KafkaEventPublisher — événement cycle de vie
            should_notify = _handle_event(msg)
        else:
            logger.debug("Kafka monitoring: message sans discriminant reconnu")

    if should_notify:
        _notify_ws()


# ── Consumer loop ─────────────────────────────────────────────────────────────

def _consumer_loop():
    bootstrap = _get_bootstrap_server()
    logger.info("Kafka consumer monitoring: connecting to %s", bootstrap)

    while True:
        try:
            from kafka import KafkaConsumer
            consumer = KafkaConsumer(
                "monitoring",
                bootstrap_servers=[bootstrap],
                auto_offset_reset="latest",
                enable_auto_commit=True,
                group_id="salle-recolte-monitor",
                value_deserializer=None,
            )
            with _state_lock:
                _state["connected"] = True
                _state["errors"] = []
            logger.info("Kafka consumer monitoring: connected")
            try:
                from routes.kafka_logs import broadcast_status
                broadcast_status(True)
            except Exception:
                pass

            for message in consumer:
                _process_message(message.value)

        except Exception as e:
            err_msg = str(e)
            logger.error("Kafka consumer monitoring error: %s", err_msg)
            with _state_lock:
                _state["connected"] = False
                _state["errors"].append({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "msg": err_msg,
                })
                _state["errors"] = _state["errors"][-10:]
            try:
                from routes.kafka_logs import broadcast_status
                broadcast_status(False, err_msg)
            except Exception:
                pass

            time.sleep(10)


def start_consumer():
    """Start the background Kafka consumer thread (idempotent)."""
    global _consumer_thread
    if _consumer_thread and _consumer_thread.is_alive():
        return
    _consumer_thread = threading.Thread(
        target=_consumer_loop,
        name="kafka-monitoring-consumer",
        daemon=True,
    )
    _consumer_thread.start()
    logger.info("Kafka consumer thread started")


# ── Snapshots ─────────────────────────────────────────────────────────────────

def get_state_snapshot() -> dict:
    """Snapshot SalleReporter — état upload des 30 PCs."""
    with _state_lock:
        pcs = []
        for pc_id in range(1, 31):
            hostname = f"PC-{pc_id:05d}"
            data = _state["pcs"].get(pc_id)

            if data:
                pc = {
                    "pc_id":             data["pc_id"],
                    "hostname":          data.get("hostname") or hostname,
                    "operator_username": data.get("operator_username") or None,
                    "is_recording":      bool(data.get("is_recording")),
                    "has_alert":         bool(data.get("has_alert") or data.get("_disconnected")),
                    "sqlite_queue":      data.get("sqlite_queue"),
                    "last_send":         data.get("last_send"),
                    "last_seen_at":      data.get("last_seen_at"),
                    "_disconnected":     bool(data.get("_disconnected")),
                }
            elif pc_id in _pc_ever_seen:
                pc = {
                    "pc_id": pc_id, "hostname": hostname,
                    "operator_username": None, "is_recording": False,
                    "has_alert": False, "sqlite_queue": None, "last_send": None,
                    "last_seen_at": None, "_disconnected": True,
                }
            else:
                pc = {
                    "pc_id": pc_id, "hostname": hostname,
                    "operator_username": None, "is_recording": False,
                    "has_alert": False, "sqlite_queue": None, "last_send": None,
                    "last_seen_at": None, "_never_seen": True,
                }

            pcs.append(pc)

        return {
            "connected":   _state["connected"],
            "last_update": _state["last_update"],
            "errors":      list(_state["errors"]),
            "pcs":         pcs,
        }


def get_stations_snapshot() -> dict:
    """Snapshot KafkaEventPublisher — état cycle de vie des stations."""
    now = time.time()
    with _state_lock:
        stations = []
        for st in _stations.values():
            # Marquer comme déconnectée si silencieuse depuis trop longtemps
            connected = st["connected"]
            if connected and st["last_ts"] > 0:
                if (now - st["last_ts"]) > PRESENCE_TIMEOUT_S:
                    connected = False

            stations.append({
                "station_id":       st["station_id"],
                "operator":         st["operator"],
                "scenario":         st["scenario"],
                "alert":            bool(st.get("alert", False)),
                "cameras":          list(st["cameras"]),
                "grippers":         dict(st["grippers"]),
                "trackers":         dict(st["trackers"]),
                "recording":        dict(st["recording"]),
                "upload":           dict(st["upload"]) if st.get("upload") else None,
                "connected":        connected,
                "last_ts":          st["last_ts"],
                "integrity_alerts": list(_integrity_alerts.get(st["station_id"], [])),
                "device_faults":    list(st.get("device_faults", {}).values()),
            })

        total = len(stations)
        connected_count = sum(1 for s in stations if s["connected"])
        recording_count = sum(1 for s in stations if s["connected"] and s["recording"]["is_recording"])

        if _spool["snapshot"] is not None:
            spool = dict(_spool["snapshot"])
            spool["daemon"]  = _spool["daemon"]
            spool["active"]  = list(_spool["active"].values())
            spool["history"] = list(_spool["history"])
        else:
            spool = {
                "consumer_ok":     _spool["consumer_ok"],
                "last_ts":         _spool["last_ts"],
                "processed_total": _spool["processed_total"],
                "failed_total":    _spool["failed_total"],
                "active":          list(_spool["active"].values()),
                "history":         list(_spool["history"]),
                "daemon":          _spool["daemon"],
            }

        return {
            "connected":   _state["connected"],
            "last_update": _state["last_update"],
            "errors":      list(_state["errors"]),
            "stats": {
                "total":      total,
                "connected":  connected_count,
                "recording":  recording_count,
                "disconnected": total - connected_count,
            },
            "stations": stations,
            "spool":    spool,
        }
