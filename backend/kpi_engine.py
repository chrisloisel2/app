"""
kpi_engine.py
=============
Pure-Python KPI aggregation.  Takes a list of metadata dicts (one per session),
returns computed KPI dicts.  All field access uses .get() so missing fields
degrade to None gracefully.
"""

from __future__ import annotations
import re
from collections import defaultdict
from datetime import datetime, date, timedelta
from typing import Any

SESSION_DATE_RE = re.compile(r"session_(\d{4})(\d{2})(\d{2})")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_sum(values: list) -> float:
    return round(sum(v for v in values if v is not None), 3)


def _safe_mean(values: list) -> float | None:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 3) if vals else None


def _pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round(numerator / denominator * 100, 1)


def _bool_pct(items: list[dict], key: str) -> float | None:
    vals = [m.get(key) for m in items if m.get(key) is not None]
    if not vals:
        return None
    return _pct(sum(1 for v in vals if v), len(vals))


def _extract_date(meta: dict) -> str | None:
    """Return ISO date string. Falls back to parsing _session_id folder name."""
    d = meta.get("session_date")
    if d:
        return str(d)[:10]
    sid = meta.get("_session_id", "")
    m = SESSION_DATE_RE.search(sid)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _group_by(items: list[dict], key_fn) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        k = key_fn(item)
        if k is not None:
            groups[k].append(item)
    return dict(groups)


def _latency_hours(meta: dict) -> float | None:
    cap = meta.get("capture_time")
    deliv = meta.get("delivery_time")
    if not cap or not deliv:
        return None
    try:
        fmt = "%Y-%m-%dT%H:%M:%S"
        delta = datetime.fromisoformat(str(deliv)) - datetime.fromisoformat(str(cap))
        return round(delta.total_seconds() / 3600, 2)
    except Exception:
        return None


# ── 1. Overview ───────────────────────────────────────────────────────────────

def compute_overview(all_meta: list[dict]) -> dict:
    if not all_meta:
        return {}

    accepted = _safe_sum([m.get("actual_hours") for m in all_meta if m.get("gate_passed")])
    raw      = _safe_sum([m.get("raw_hours") for m in all_meta])
    planned  = _safe_sum([m.get("planned_hours") for m in all_meta])
    actual   = _safe_sum([m.get("actual_hours") for m in all_meta])

    uptime_m   = _safe_sum([m.get("uptime_minutes") for m in all_meta])
    downtime_m = _safe_sum([m.get("downtime_minutes") for m in all_meta])
    total_time = uptime_m + downtime_m

    rigs    = {m.get("rig_id") for m in all_meta if m.get("rig_id")}
    dates   = {_extract_date(m) for m in all_meta if _extract_date(m)}
    n_days  = max(len(dates), 1)

    costs   = [m.get("cost_total") for m in all_meta if m.get("cost_total") is not None]
    revs    = [m.get("revenue") for m in all_meta if m.get("revenue") is not None]
    total_cost = _safe_sum(costs)
    total_rev  = _safe_sum(revs)

    # On-time: session delivered before planned end (if delivery_time + planned_hours exist)
    on_time_vals = [m.get("on_time") for m in all_meta if m.get("on_time") is not None]

    return {
        "total_sessions":          len(all_meta),
        "accepted_hours_global":   accepted,
        "raw_hours_global":        raw,
        "acceptance_rate_pct":     _pct(accepted, raw),
        "throughput_per_day":      round(accepted / n_days, 2) if n_days else None,
        "throughput_per_week":     round(accepted / n_days * 7, 2) if n_days else None,
        "planned_hours_global":    planned,
        "actual_hours_global":     actual,
        "variance_hours":          round(actual - planned, 2) if (planned and actual) else None,
        "uptime_pct_global":       _pct(uptime_m, total_time),
        "downtime_hours_global":   round(downtime_m / 60, 2),
        "active_rigs_global":      len(rigs),
        "rig_hours_available":     round(total_time / 60, 2),
        "gate_pass_rate_pct":      _bool_pct(all_meta, "gate_passed"),
        "rejected_pct":            _bool_pct(all_meta, "rejected"),
        "rework_pct":              _bool_pct(all_meta, "rework"),
        "cost_per_accepted_hour":  round(total_cost / accepted, 2) if accepted else None,
        "cost_per_raw_hour":       round(total_cost / raw, 2) if raw else None,
        "gross_margin_pct":        _pct(total_rev - total_cost, total_rev),
        "total_cost_eur":          total_cost,
        "total_revenue_eur":       total_rev,
        "upload_success_rate_pct": _bool_pct(all_meta, "upload_success"),
        "dataset_completeness_pct": _safe_mean([m.get("dataset_complete") for m in all_meta
                                                  if m.get("dataset_complete") is not None]),
        "on_time_delivery_pct":    _bool_pct(all_meta, "on_time") if on_time_vals else None,
        "critical_incidents_total": sum(1 for m in all_meta if m.get("critical_incident")),
    }


# ── 2. Daily ─────────────────────────────────────────────────────────────────

def compute_daily(all_meta: list[dict], days: int = 30) -> list[dict]:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    groups = _group_by(all_meta, _extract_date)
    result = []
    for day_str in sorted(groups.keys()):
        if day_str < cutoff:
            continue
        items = groups[day_str]
        accepted = _safe_sum([m.get("actual_hours") for m in items if m.get("gate_passed")])
        raw      = _safe_sum([m.get("raw_hours") for m in items])
        uptime_m   = _safe_sum([m.get("uptime_minutes") for m in items])
        downtime_m = _safe_sum([m.get("downtime_minutes") for m in items])
        rigs_active = len({m.get("rig_id") for m in items if m.get("rig_id")})
        ops_sched   = _safe_sum([m.get("operators_scheduled") for m in items])
        ops_pres    = _safe_sum([m.get("operators_present") for m in items])
        rework_h    = _safe_sum([m.get("rework_hours") for m in items])
        costs       = _safe_sum([m.get("cost_total") for m in items])
        revs        = _safe_sum([m.get("revenue") for m in items])
        result.append({
            "date":                  day_str,
            "sessions":              len(items),
            "accepted_hours":        accepted,
            "raw_hours":             raw,
            "acceptance_rate_pct":   _pct(accepted, raw),
            "uptime_pct":            _pct(uptime_m, uptime_m + downtime_m),
            "downtime_hours":        round(downtime_m / 60, 2),
            "rework_hours":          rework_h,
            "rework_pct":            _bool_pct(items, "rework"),
            "gate_pass_rate_pct":    _bool_pct(items, "gate_passed"),
            "rejected_pct":          _bool_pct(items, "rejected"),
            "rigs_active":           rigs_active,
            "operators_scheduled":   int(ops_sched),
            "operators_present":     int(ops_pres),
            "attendance_rate_pct":   _pct(ops_pres, ops_sched),
            "upload_success_rate_pct": _bool_pct(items, "upload_success"),
            "critical_incident":     any(m.get("critical_incident") for m in items),
            "gross_margin_pct":      _pct(revs - costs, revs),
        })
    return result


# ── 3. By Operator ────────────────────────────────────────────────────────────

def compute_by_operator(all_meta: list[dict]) -> list[dict]:
    groups = _group_by(all_meta, lambda m: m.get("operator_id"))
    result = []
    for op_id in sorted(groups.keys()):
        items = groups[op_id]
        accepted   = _safe_sum([m.get("actual_hours") for m in items if m.get("gate_passed")])
        raw        = _safe_sum([m.get("raw_hours") for m in items])
        eff_h      = _safe_sum([m.get("effective_hours") for m in items])
        rework_h   = _safe_sum([m.get("rework_hours") for m in items])
        downtime_m = _safe_sum([m.get("downtime_minutes") for m in items])
        uptime_m   = _safe_sum([m.get("uptime_minutes") for m in items])
        defect_dens = _safe_mean([m.get("defect_density") for m in items
                                   if m.get("defect_density") is not None])
        result.append({
            "operator_id":          op_id,
            "session_count":        len(items),
            "raw_hours":            raw,
            "accepted_hours":       accepted,
            "acceptance_rate_pct":  _pct(accepted, raw),
            "gate_pass_rate_pct":   _bool_pct(items, "gate_passed"),
            "rejected_pct":         _bool_pct(items, "rejected"),
            "rework_pct":           _bool_pct(items, "rework"),
            "rework_hours":         rework_h,
            "defect_rate_pct":      _bool_pct(items, "defect"),
            "defect_density":       defect_dens,
            "downtime_hours":       round(downtime_m / 60, 2),
            "operating_rate_pct":   _pct(uptime_m, uptime_m + downtime_m),
            "effective_hours":      eff_h,
            "capture_efficiency":   round(accepted / eff_h, 3) if eff_h else None,
        })
    return result


# ── 4. By Shift ───────────────────────────────────────────────────────────────

def compute_by_shift(all_meta: list[dict]) -> list[dict]:
    groups = _group_by(all_meta, lambda m: m.get("shift"))
    result = []
    for shift in sorted(groups.keys()):
        items = groups[shift]
        accepted   = _safe_sum([m.get("actual_hours") for m in items if m.get("gate_passed")])
        raw        = _safe_sum([m.get("raw_hours") for m in items])
        rework_h   = _safe_sum([m.get("rework_hours") for m in items])
        rework_cost = _safe_sum([m.get("cost_rework") for m in items])
        dates      = {_extract_date(m) for m in items if _extract_date(m)}
        n_days     = max(len(dates), 1)
        ds_compl   = [m.get("dataset_complete") for m in items if m.get("dataset_complete") is not None]
        setup_times = [m.get("setup_time_min") for m in items if m.get("setup_time_min") is not None]
        result.append({
            "shift":                  shift,
            "session_count":          len(items),
            "raw_hours":              raw,
            "accepted_hours":         accepted,
            "acceptance_rate_pct":    _pct(accepted, raw),
            "throughput_h_per_day":   round(accepted / n_days, 2),
            "rework_hours":           rework_h,
            "rework_pct":             _bool_pct(items, "rework"),
            "defect_rate_pct":        _bool_pct(items, "defect"),
            "upload_success_rate_pct": _bool_pct(items, "upload_success"),
            "data_loss_rate_pct":     _bool_pct(items, "data_loss"),
            "dataset_completeness_pct": round(_safe_mean(ds_compl) or 0, 1),
            "setup_time_avg_min":     _safe_mean(setup_times),
            "rework_cost_eur":        rework_cost,
        })
    return result


# ── 5. By Rig ─────────────────────────────────────────────────────────────────

def compute_by_rig(all_meta: list[dict]) -> dict:
    groups = _group_by(all_meta, lambda m: m.get("rig_id"))
    rigs = []
    for rig_id in sorted(groups.keys()):
        items = groups[rig_id]
        uptime_m   = _safe_sum([m.get("uptime_minutes") for m in items])
        downtime_m = _safe_sum([m.get("downtime_minutes") for m in items])
        accepted   = _safe_sum([m.get("actual_hours") for m in items if m.get("gate_passed")])
        raw        = _safe_sum([m.get("raw_hours") for m in items])
        rigs.append({
            "rig_id":              rig_id,
            "session_count":       len(items),
            "uptime_pct":          _pct(uptime_m, uptime_m + downtime_m),
            "downtime_hours":      round(downtime_m / 60, 2),
            "rig_hours_available": round((uptime_m + downtime_m) / 60, 2),
            "raw_hours":           raw,
            "accepted_hours":      accepted,
        })
    all_rigs = len(groups)
    return {
        "rigs":              rigs,
        "rigs_active_global": all_rigs,
        "rigs_total_global": all_rigs,
    }


# ── 6. Annotation ─────────────────────────────────────────────────────────────

def compute_annotation(all_meta: list[dict]) -> dict:
    groups = _group_by(all_meta, lambda m: m.get("annotator_id"))
    annotators = []
    for ann_id in sorted(groups.keys()):
        items = groups[ann_id]
        compl  = [m.get("annotation_complete") for m in items if m.get("annotation_complete") is not None]
        acc    = [m.get("annotation_accuracy") for m in items if m.get("annotation_accuracy") is not None]
        iaa    = [m.get("inter_annotator_agreement") for m in items if m.get("inter_annotator_agreement") is not None]
        times  = [m.get("annotation_time_min") for m in items if m.get("annotation_time_min") is not None]
        annotators.append({
            "annotator_id":               ann_id,
            "session_count":              len(items),
            "label_completeness_pct":     round((_safe_mean(compl) or 0) * 100, 1),
            "label_accuracy_pct":         round((_safe_mean(acc) or 0) * 100, 1),
            "inter_annotator_agreement":  _safe_mean(iaa),
            "annotation_time_avg_min":    _safe_mean(times),
        })
    all_compl = [m.get("annotation_complete") for m in all_meta if m.get("annotation_complete") is not None]
    all_acc   = [m.get("annotation_accuracy") for m in all_meta if m.get("annotation_accuracy") is not None]
    return {
        "annotators": annotators,
        "global": {
            "label_completeness_pct": round((_safe_mean(all_compl) or 0) * 100, 1),
            "label_accuracy_pct":     round((_safe_mean(all_acc) or 0) * 100, 1),
        },
    }


# ── 7. Staffing ───────────────────────────────────────────────────────────────

def compute_staffing(all_meta: list[dict]) -> dict:
    by_shift: list[dict] = []
    groups = _group_by(all_meta, lambda m: (m.get("shift"), _extract_date(m)))
    for (shift, day), items in sorted(groups.items()):
        sched = _safe_sum([m.get("operators_scheduled") for m in items])
        pres  = _safe_sum([m.get("operators_present") for m in items])
        eff_h = _safe_sum([m.get("effective_hours") for m in items])
        by_shift.append({
            "shift":                shift,
            "date":                 day,
            "operators_scheduled":  int(sched),
            "operators_present":    int(pres),
            "attendance_rate_pct":  _pct(pres, sched),
            "effective_hours":      eff_h,
        })
    all_sched = _safe_sum([m.get("operators_scheduled") for m in all_meta])
    all_pres  = _safe_sum([m.get("operators_present") for m in all_meta])
    all_eff   = _safe_sum([m.get("effective_hours") for m in all_meta])
    turnover  = _safe_mean([m.get("turnover_pct") for m in all_meta if m.get("turnover_pct") is not None])
    training  = _safe_sum([m.get("training_hours") for m in all_meta])
    return {
        "by_shift": by_shift,
        "global": {
            "attendance_rate_pct":   _pct(all_pres, all_sched),
            "effective_hours_total": all_eff,
            "turnover_pct":          turnover,
            "training_hours_total":  training,
        },
    }


# ── 8. Incidents ──────────────────────────────────────────────────────────────

def compute_incidents(all_meta: list[dict]) -> dict:
    by_day: list[dict] = []
    groups_day = _group_by(all_meta, _extract_date)
    for day_str in sorted(groups_day.keys()):
        items = groups_day[day_str]
        uptime_m   = _safe_sum([m.get("uptime_minutes") for m in items])
        downtime_m = _safe_sum([m.get("downtime_minutes") for m in items])
        by_day.append({
            "date":              day_str,
            "critical_incident": any(m.get("critical_incident") for m in items),
            "resolution_time_min": _safe_mean([m.get("resolution_time_min") for m in items
                                               if m.get("resolution_time_min") is not None]),
            "operating_rate_pct": _pct(uptime_m, uptime_m + downtime_m),
        })
    by_op: list[dict] = []
    groups_op = _group_by(all_meta, lambda m: m.get("operator_id"))
    for op_id in sorted(groups_op.keys()):
        items = groups_op[op_id]
        uptime_m   = _safe_sum([m.get("uptime_minutes") for m in items])
        downtime_m = _safe_sum([m.get("downtime_minutes") for m in items])
        by_op.append({
            "operator_id":       op_id,
            "incidents":         sum(1 for m in items if m.get("critical_incident")),
            "operating_rate_pct": _pct(uptime_m, uptime_m + downtime_m),
        })
    all_res = [m.get("resolution_time_min") for m in all_meta if m.get("resolution_time_min") is not None]
    return {
        "critical_incidents_total": sum(1 for m in all_meta if m.get("critical_incident")),
        "resolution_time_avg_min":  _safe_mean(all_res),
        "by_day":       by_day,
        "by_operator":  by_op,
    }


# ── 9. Data Integrity ─────────────────────────────────────────────────────────

def compute_data_integrity(all_meta: list[dict]) -> dict:
    latencies = [_latency_hours(m) for m in all_meta]
    latencies = [l for l in latencies if l is not None]
    backlog    = sum(1 for m in all_meta
                     if m.get("upload_success") is False or m.get("dataset_complete", 1.0) < 1.0)
    ds_compl   = [m.get("dataset_complete") for m in all_meta if m.get("dataset_complete") is not None]
    by_shift: list[dict] = []
    groups = _group_by(all_meta, lambda m: m.get("shift"))
    for shift in sorted(groups.keys()):
        items = groups[shift]
        dc = [m.get("dataset_complete") for m in items if m.get("dataset_complete") is not None]
        by_shift.append({
            "shift":                    shift,
            "upload_success_rate_pct":  _bool_pct(items, "upload_success"),
            "data_loss_rate_pct":       _bool_pct(items, "data_loss"),
            "dataset_completeness_pct": round((_safe_mean(dc) or 0) * 100, 1),
        })
    return {
        "upload_success_rate_pct":      _bool_pct(all_meta, "upload_success"),
        "data_loss_rate_pct":           _bool_pct(all_meta, "data_loss"),
        "dataset_completeness_pct":     round((_safe_mean(ds_compl) or 0) * 100, 1),
        "avg_capture_to_delivery_hours": _safe_mean(latencies),
        "qa_backlog_sessions":          backlog,
        "by_shift":                     by_shift,
    }


# ── 10. Finance ───────────────────────────────────────────────────────────────

def compute_finance(all_meta: list[dict]) -> dict:
    accepted    = _safe_sum([m.get("actual_hours") for m in all_meta if m.get("gate_passed")])
    raw         = _safe_sum([m.get("raw_hours") for m in all_meta])
    total_cost  = _safe_sum([m.get("cost_total") for m in all_meta])
    total_rev   = _safe_sum([m.get("revenue") for m in all_meta])
    total_rework = _safe_sum([m.get("cost_rework") for m in all_meta])

    by_day_g = _group_by(all_meta, _extract_date)
    by_day: list[dict] = []
    for day_str in sorted(by_day_g.keys()):
        items = by_day_g[day_str]
        c = _safe_sum([m.get("cost_total") for m in items])
        r = _safe_sum([m.get("revenue") for m in items])
        by_day.append({
            "date":            day_str,
            "rework_cost_eur": _safe_sum([m.get("cost_rework") for m in items]),
            "gross_margin_pct": _pct(r - c, r),
        })

    by_shift_g = _group_by(all_meta, lambda m: m.get("shift"))
    by_shift: list[dict] = []
    for shift in sorted(by_shift_g.keys()):
        items = by_shift_g[shift]
        by_shift.append({
            "shift":           shift,
            "rework_cost_eur": _safe_sum([m.get("cost_rework") for m in items]),
        })

    return {
        "cost_per_accepted_hour": round(total_cost / accepted, 2) if accepted else None,
        "cost_per_raw_hour":      round(total_cost / raw, 2) if raw else None,
        "gross_margin_pct":       _pct(total_rev - total_cost, total_rev),
        "total_cost_eur":         total_cost,
        "total_revenue_eur":      total_rev,
        "rework_cost_eur_total":  total_rework,
        "by_day":                 by_day,
        "by_shift":               by_shift,
    }


# ── 11. Production / Capacity ─────────────────────────────────────────────────

def compute_production(all_meta: list[dict]) -> dict:
    setup_t   = [m.get("setup_time_min") for m in all_meta if m.get("setup_time_min") is not None]
    cap_t     = [m.get("capture_time_min") for m in all_meta if m.get("capture_time_min") is not None]
    reset_t   = [m.get("reset_time_min") for m in all_meta if m.get("reset_time_min") is not None]
    upload_t  = [m.get("upload_time_min") for m in all_meta if m.get("upload_time_min") is not None]

    def _cycle(m: dict) -> float | None:
        parts = [m.get("setup_time_min"), m.get("capture_time_min"),
                 m.get("reset_time_min"), m.get("upload_time_min")]
        if all(p is not None for p in parts):
            return sum(parts)
        return None

    cycle_times = [_cycle(m) for m in all_meta]
    cycle_times = [c for c in cycle_times if c is not None]

    accepted   = _safe_sum([m.get("actual_hours") for m in all_meta if m.get("gate_passed")])
    eff_h      = _safe_sum([m.get("effective_hours") for m in all_meta])
    op_hours   = _safe_sum([m.get("op_hours") for m in all_meta])

    groups = _group_by(all_meta, lambda m: m.get("scenario"))
    by_scenario: list[dict] = []
    for sc in sorted(groups.keys()):
        items = groups[sc]
        sc_cycle = [_cycle(m) for m in items]
        sc_cycle = [c for c in sc_cycle if c is not None]
        sc_reset = [m.get("reset_time_min") for m in items if m.get("reset_time_min") is not None]
        by_scenario.append({
            "scenario":           sc,
            "session_count":      len(items),
            "cycle_time_avg_min": _safe_mean(sc_cycle),
            "reset_time_avg_min": _safe_mean(sc_reset),
        })

    return {
        "cycle_time_avg_min":      _safe_mean(cycle_times),
        "setup_time_avg_min":      _safe_mean(setup_t),
        "capture_time_avg_min":    _safe_mean(cap_t),
        "reset_time_avg_min":      _safe_mean(reset_t),
        "upload_time_avg_min":     _safe_mean(upload_t),
        "op_hours_total":          op_hours,
        "capture_efficiency_global": round(accepted / eff_h, 3) if eff_h else None,
        "by_scenario":             by_scenario,
    }
