"""
nas_client.py
=============
Remplace hive_client.py — lit les fichiers CSV directement depuis le NAS
monté en NFS. Chaque session contient :
  <NAS_SESSIONS_DIR>/session_<id>/tracker_positions.csv
  <NAS_SESSIONS_DIR>/session_<id>/pince1_data.csv
  <NAS_SESSIONS_DIR>/session_<id>/pince2_data.csv
  <NAS_SESSIONS_DIR>/session_<id>/metadata.json
"""

import csv
import json
import os
import re
from typing import Any

import config

SESSION_RE = re.compile(r"^session_")

TRACKER_FIELDS = [
    "timestamp", "time_seconds", "timestamp_ns", "frame_number",
    "tracker_1_x", "tracker_1_y", "tracker_1_z",
    "tracker_1_qw", "tracker_1_qx", "tracker_1_qy", "tracker_1_qz",
    "tracker_2_x", "tracker_2_y", "tracker_2_z",
    "tracker_2_qw", "tracker_2_qx", "tracker_2_qy", "tracker_2_qz",
    "tracker_3_x", "tracker_3_y", "tracker_3_z",
    "tracker_3_qw", "tracker_3_qx", "tracker_3_qy", "tracker_3_qz",
]

PINCE_FIELDS = [
    "timestamp", "time_seconds", "timestamp_ns", "t_ms",
    "pince_id", "sw", "ouverture_mm", "angle_deg",
]

NUMERIC_FIELDS = {
    "time_seconds", "timestamp_ns", "frame_number", "t_ms",
    "tracker_1_x", "tracker_1_y", "tracker_1_z",
    "tracker_1_qw", "tracker_1_qx", "tracker_1_qy", "tracker_1_qz",
    "tracker_2_x", "tracker_2_y", "tracker_2_z",
    "tracker_2_qw", "tracker_2_qx", "tracker_2_qy", "tracker_2_qz",
    "tracker_3_x", "tracker_3_y", "tracker_3_z",
    "tracker_3_qw", "tracker_3_qx", "tracker_3_qy", "tracker_3_qz",
    "ouverture_mm", "angle_deg",
}


def _sessions_dir() -> str:
    return config.NAS_SESSIONS_DIR


def _session_path(session_id: str) -> str:
    name = session_id if session_id.startswith("session_") else f"session_{session_id}"
    return os.path.join(_sessions_dir(), name)


def _cast(field: str, value: str) -> Any:
    if field not in NUMERIC_FIELDS:
        return value
    if value == "" or value is None:
        return None
    try:
        if field in ("timestamp_ns", "frame_number", "t_ms"):
            return int(float(value))
        return float(value)
    except ValueError:
        return value


def _read_csv(path: str, fields: list[str], limit: int = 0, offset: int = 0) -> list[dict]:
    """Read a CSV file and return rows as dicts, with optional pagination."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, raw_row in enumerate(reader):
            if i < offset:
                continue
            if limit and len(rows) >= limit:
                break
            row = {}
            for field in fields:
                raw = raw_row.get(field, "")
                row[field] = _cast(field, raw)
            rows.append(row)
    return rows


# ── Public API ────────────────────────────────────────────────────────────────

def list_sessions() -> list[str]:
    """Return sorted list of session IDs (folder names) on the NAS."""
    base = _sessions_dir()
    if not os.path.isdir(base):
        return []
    return sorted(
        [d for d in os.listdir(base)
         if SESSION_RE.match(d) and os.path.isdir(os.path.join(base, d))],
        reverse=True,
    )


def session_exists(session_id: str) -> bool:
    return os.path.isdir(_session_path(session_id))


def get_tracker_rows(session_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    path = os.path.join(_session_path(session_id), "tracker_positions.csv")
    if not os.path.exists(path):
        return []
    return _read_csv(path, TRACKER_FIELDS, limit=limit, offset=offset)


def get_pince_rows(session_id: str, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
    """table: 'pince1_data' or 'pince2_data'"""
    filename = f"{table}.csv"
    path = os.path.join(_session_path(session_id), filename)
    if not os.path.exists(path):
        return []
    return _read_csv(path, PINCE_FIELDS, limit=limit, offset=offset)


def get_tracker_stats(session_id: str) -> dict:
    """Compute summary stats for tracker_positions without loading all rows at once."""
    path = os.path.join(_session_path(session_id), "tracker_positions.csv")
    if not os.path.exists(path):
        return {}

    count = 0
    start_ts = end_ts = None
    first_frame = last_frame = None
    sums = {f: 0.0 for f in (
        "tracker_1_x", "tracker_1_y", "tracker_1_z",
        "tracker_2_x", "tracker_2_y", "tracker_2_z",
        "tracker_3_x", "tracker_3_y", "tracker_3_z",
    )}

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            count += 1
            ts = raw.get("timestamp", "")
            if start_ts is None or ts < start_ts:
                start_ts = ts
            if end_ts is None or ts > end_ts:
                end_ts = ts
            try:
                fn = int(float(raw.get("frame_number", 0)))
                if first_frame is None or fn < first_frame:
                    first_frame = fn
                if last_frame is None or fn > last_frame:
                    last_frame = fn
            except (ValueError, TypeError):
                pass
            for f_name in sums:
                try:
                    sums[f_name] += float(raw.get(f_name, 0) or 0)
                except (ValueError, TypeError):
                    pass

    if count == 0:
        return {}

    result = {
        "frame_count": count,
        "start_ts": start_ts,
        "end_ts": end_ts,
        "first_frame": first_frame,
        "last_frame": last_frame,
    }
    for f_name, total in sums.items():
        # avg_tracker_1_x -> avg_t1_x
        parts = f_name.split("_")  # ["tracker","1","x"]
        short = f"avg_t{parts[1]}_{parts[2]}"
        result[short] = round(total / count, 6)
    return result


def get_pince_stats(session_id: str) -> list[dict]:
    """Aggregate stats for pince1 + pince2 combined, grouped by pince_id."""
    stats: dict[str, dict] = {}

    for table in ("pince1_data", "pince2_data"):
        path = os.path.join(_session_path(session_id), f"{table}.csv")
        if not os.path.exists(path):
            continue
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                pid = raw.get("pince_id", "")
                if pid not in stats:
                    stats[pid] = {"pince_id": pid, "nb_mesures": 0,
                                  "_sum_ouv": 0.0, "_max_ouv": None,
                                  "_sum_ang": 0.0}
                s = stats[pid]
                s["nb_mesures"] += 1
                try:
                    ouv = float(raw.get("ouverture_mm", 0) or 0)
                    s["_sum_ouv"] += ouv
                    if s["_max_ouv"] is None or ouv > s["_max_ouv"]:
                        s["_max_ouv"] = ouv
                except (ValueError, TypeError):
                    pass
                try:
                    s["_sum_ang"] += float(raw.get("angle_deg", 0) or 0)
                except (ValueError, TypeError):
                    pass

    result = []
    for s in stats.values():
        n = s["nb_mesures"]
        result.append({
            "pince_id": s["pince_id"],
            "nb_mesures": n,
            "avg_ouverture_mm": round(s["_sum_ouv"] / n, 2) if n else None,
            "max_ouverture_mm": round(s["_max_ouv"], 2) if s["_max_ouv"] is not None else None,
            "avg_angle_deg": round(s["_sum_ang"] / n, 2) if n else None,
        })
    return result


def read_metadata(session_id: str) -> dict:
    """Read metadata.json for a session. Returns dict or raises."""
    path = os.path.join(_session_path(session_id), "metadata.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise RuntimeError("metadata.json n'est pas un objet JSON")
    return data
