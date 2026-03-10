"""
cache_manager.py
================
Cache intelligent pour les données NAS (sessions, metadata, stats CSV, KPIs).

Stratégie :
  - sessions_list    : TTL 30s  — la liste des dossiers session_* sur le NAS
  - session_metadata : TTL 5min par session — metadata.json (immuable une fois écrit)
  - session_stats    : TTL 5min par session — tracker/pince stats (immuable une fois calculé)
  - kpi_data         : TTL 60s  — résultats KPI agrégés
  - Invalidation explicite sur événements Kafka (upload_completed, pipeline/completed)

Thread-safe via threading.Lock par catégorie.
"""

import logging
import threading
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ── TTL constants ──────────────────────────────────────────────────────────────

TTL_SESSIONS_LIST   = 30       # secondes — liste des sessions NAS
TTL_SESSION_META    = 300      # 5 min — metadata.json par session
TTL_SESSION_STATS   = 300      # 5 min — tracker/pince stats par session
TTL_KPI             = 60       # 1 min — résultats KPI


# ── Generic TTL cache entry ────────────────────────────────────────────────────

class _CacheEntry:
    __slots__ = ("value", "expires_at")

    def __init__(self, value: Any, ttl: float):
        self.value      = value
        self.expires_at = time.monotonic() + ttl

    def is_valid(self) -> bool:
        return time.monotonic() < self.expires_at


# ── CacheStore : dict-based TTL cache with explicit invalidation ───────────────

class CacheStore:
    def __init__(self, default_ttl: float):
        self._store: dict[str, _CacheEntry] = {}
        self._lock  = threading.Lock()
        self._default_ttl = default_ttl

    def get(self, key: str) -> tuple[bool, Any]:
        """Return (hit, value). Value is None on miss."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None or not entry.is_valid():
                if entry is not None:
                    del self._store[key]
                return False, None
            return True, entry.value

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        with self._lock:
            self._store[key] = _CacheEntry(value, ttl if ttl is not None else self._default_ttl)

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def invalidate_all(self) -> None:
        with self._lock:
            self._store.clear()

    def get_or_compute(self, key: str, fn: Callable[[], Any], ttl: Optional[float] = None) -> Any:
        """
        Return cached value or compute it via fn(), store it, and return it.
        fn() is called WITHOUT holding the lock to avoid blocking other reads.
        """
        hit, value = self.get(key)
        if hit:
            return value
        # Compute outside lock
        value = fn()
        self.set(key, value, ttl)
        return value


# ── Global cache stores ────────────────────────────────────────────────────────

# Unique key: "sessions_list"
sessions_list_cache = CacheStore(TTL_SESSIONS_LIST)

# Key: session_id
metadata_cache = CacheStore(TTL_SESSION_META)

# Key: "<session_id>:tracker_stats" or "<session_id>:pince_stats"
stats_cache = CacheStore(TTL_SESSION_STATS)

# Key: kpi endpoint name (e.g. "overview", "daily_30", "operators", ...)
kpi_cache = CacheStore(TTL_KPI)


# ── Public helpers ─────────────────────────────────────────────────────────────

def get_sessions_list(fn: Callable[[], list]) -> list:
    """Return cached session list or recompute."""
    return sessions_list_cache.get_or_compute("sessions_list", fn)


def get_session_metadata(session_id: str, fn: Callable[[], dict]) -> dict:
    """Return cached metadata for session_id or load via fn()."""
    return metadata_cache.get_or_compute(session_id, fn)


def get_tracker_stats(session_id: str, fn: Callable[[], dict]) -> dict:
    key = f"{session_id}:tracker_stats"
    return stats_cache.get_or_compute(key, fn)


def get_pince_stats(session_id: str, fn: Callable[[], list]) -> list:
    key = f"{session_id}:pince_stats"
    return stats_cache.get_or_compute(key, fn)


def get_kpi(kpi_key: str, fn: Callable[[], Any]) -> Any:
    """Return cached KPI result or recompute."""
    return kpi_cache.get_or_compute(kpi_key, fn)


def get_all_metadata(sessions_fn: Callable[[], list], meta_fn: Callable[[str], dict]) -> list[dict]:
    """
    Load all sessions metadata, using per-session cache.
    sessions_fn() -> list of session_ids
    meta_fn(session_id) -> metadata dict (raises on error)
    """
    session_ids = get_sessions_list(sessions_fn)
    result = []
    for sid in session_ids:
        try:
            meta = get_session_metadata(sid, lambda s=sid: meta_fn(s))
            entry = dict(meta)
            entry["_session_id"] = sid
            result.append(entry)
        except Exception:
            pass
    return result


# ── Invalidation API (called from kafka_consumer on upload events) ─────────────

def on_session_completed(session_id: str) -> None:
    """
    Called when a session finishes uploading/processing.
    Invalidates the sessions list and any stale stats for that session.
    The metadata will be re-read fresh on next access.
    """
    logger.debug("cache_manager: invalidating session %s", session_id)
    sessions_list_cache.invalidate("sessions_list")
    # Metadata might have been updated by the pipeline — force refresh
    metadata_cache.invalidate(session_id)
    stats_cache.invalidate(f"{session_id}:tracker_stats")
    stats_cache.invalidate(f"{session_id}:pince_stats")
    # KPIs now stale
    kpi_cache.invalidate_all()


def on_sessions_changed() -> None:
    """Force refresh of the session list (e.g. new folder detected)."""
    sessions_list_cache.invalidate("sessions_list")
    kpi_cache.invalidate_all()
