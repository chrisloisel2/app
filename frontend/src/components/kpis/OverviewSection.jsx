import { useEffect, useState } from "react";
import { fetchKpiOverview } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

export default function OverviewSection() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiOverview().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const d = data || {};
  const f = (v, dec=1) => v != null ? +v.toFixed(dec) : null;

  const groups = [
    {
      title: "KPIs Stratégiques",
      cards: [
        { label: "Accepted Hours",     value: f(d.accepted_hours_global,1),  unit: "h",  color: "green" },
        { label: "Raw Hours",          value: f(d.raw_hours_global,1),        unit: "h" },
        { label: "Acceptance Rate",    value: f(d.acceptance_rate_pct,1),     unit: "%",  color: d.acceptance_rate_pct >= 80 ? "green" : "red" },
        { label: "Throughput / jour",  value: f(d.throughput_per_day,2),      unit: "h/j" },
        { label: "Throughput / sem.",  value: f(d.throughput_per_week,2),     unit: "h/sem" },
        { label: "On-Time Delivery",   value: f(d.on_time_delivery_pct,1),    unit: "%",  color: d.on_time_delivery_pct >= 90 ? "green" : "amber" },
      ],
    },
    {
      title: "Production & Capacité",
      cards: [
        { label: "Planned Hours",      value: f(d.planned_hours_global,1),    unit: "h" },
        { label: "Actual Hours",       value: f(d.actual_hours_global,1),     unit: "h" },
        { label: "Variance",           value: f(d.variance_hours,1),          unit: "h",  color: (d.variance_hours||0) >= 0 ? "green" : "red" },
        { label: "Uptime %",           value: f(d.uptime_pct_global,1),       unit: "%",  color: d.uptime_pct_global >= 85 ? "green" : "amber" },
        { label: "Downtime",           value: f(d.downtime_hours_global,1),   unit: "h",  color: "red" },
        { label: "Active Rigs",        value: d.active_rigs_global,           sub: `${d.total_sessions??0} sessions` },
      ],
    },
    {
      title: "Qualité",
      cards: [
        { label: "Gate Pass Rate",     value: f(d.gate_pass_rate_pct,1),      unit: "%",  color: d.gate_pass_rate_pct >= 90 ? "green" : "amber" },
        { label: "Rejected %",         value: f(d.rejected_pct,1),            unit: "%",  color: d.rejected_pct > 15 ? "red" : "amber" },
        { label: "Rework %",           value: f(d.rework_pct,1),              unit: "%",  color: d.rework_pct > 10 ? "red" : "amber" },
        { label: "Critical Incidents", value: d.critical_incidents_total,     color: d.critical_incidents_total > 0 ? "red" : "green" },
        { label: "Upload Success",     value: f(d.upload_success_rate_pct,1), unit: "%",  color: d.upload_success_rate_pct >= 95 ? "green" : "red" },
        { label: "Dataset Completeness", value: f(d.dataset_completeness_pct,1), unit: "%" },
      ],
    },
    {
      title: "Finance",
      cards: [
        { label: "Cost / Accepted h",  value: f(d.cost_per_accepted_hour,2),  unit: "€" },
        { label: "Cost / Raw h",       value: f(d.cost_per_raw_hour,2),       unit: "€" },
        { label: "Gross Margin",       value: f(d.gross_margin_pct,1),        unit: "%",  color: d.gross_margin_pct > 0 ? "green" : "red" },
        { label: "Total Cost",         value: f(d.total_cost_eur,0),          unit: "€" },
        { label: "Total Revenue",      value: f(d.total_revenue_eur,0),       unit: "€",  color: "green" },
        { label: "Rig-Hours Avail.",   value: f(d.rig_hours_available,1),     unit: "h" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map(({ title, cards }) => (
        <div key={title}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {cards.map((c) => <KpiCard key={c.label} {...c} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
