import { useEffect, useState } from "react";
import { fetchKpiOverview, fetchKpiDaily } from "../api/client";
import KpiCard from "../components/ui/KpiCard";
import KpiLineChart from "../components/ui/KpiLineChart";
import KpiBarChart from "../components/ui/KpiBarChart";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorBanner from "../components/ui/ErrorBanner";

function fmt(v, decimals = 1) {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? +v.toFixed(decimals) : v;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [daily, setDaily]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([fetchKpiOverview(), fetchKpiDaily(14)])
      .then(([ovRes, dayRes]) => {
        setOverview(ovRes.data);
        setDaily(dayRes.data.days || []);
      })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Chargement du dashboard…" />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;
  const ov = overview || {};

  const CARDS_ROW1 = [
    { label: "Accepted Hours",    value: fmt(ov.accepted_hours_global, 1), unit: "h",  color: "green" },
    { label: "Raw Hours",         value: fmt(ov.raw_hours_global, 1),      unit: "h" },
    { label: "Acceptance Rate",   value: fmt(ov.acceptance_rate_pct, 1),   unit: "%",  color: ov.acceptance_rate_pct >= 80 ? "green" : "red" },
    { label: "Uptime",            value: fmt(ov.uptime_pct_global, 1),     unit: "%",  color: ov.uptime_pct_global >= 85 ? "green" : "amber" },
    { label: "Gate Pass Rate",    value: fmt(ov.gate_pass_rate_pct, 1),    unit: "%",  color: ov.gate_pass_rate_pct >= 90 ? "green" : "amber" },
    { label: "Cost / Acc. Hour",  value: fmt(ov.cost_per_accepted_hour, 2), unit: "€" },
  ];
  const CARDS_ROW2 = [
    { label: "Gross Margin",      value: fmt(ov.gross_margin_pct, 1),      unit: "%",  color: ov.gross_margin_pct > 0 ? "green" : "red" },
    { label: "Rework Rate",       value: fmt(ov.rework_pct, 1),            unit: "%",  color: ov.rework_pct > 10 ? "red" : "amber" },
    { label: "Upload Success",    value: fmt(ov.upload_success_rate_pct, 1), unit: "%", color: ov.upload_success_rate_pct >= 95 ? "green" : "red" },
    { label: "Active Rigs",       value: ov.active_rigs_global ?? null,    sub: `${ov.total_sessions ?? "?"} sessions` },
    { label: "Variance",          value: fmt(ov.variance_hours, 1),        unit: "h",  color: (ov.variance_hours ?? 0) >= 0 ? "green" : "red" },
    { label: "On-Time Delivery",  value: fmt(ov.on_time_delivery_pct, 1),  unit: "%",  color: ov.on_time_delivery_pct >= 90 ? "green" : "amber" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Physical Data Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Physical Data — Vue globale de la production</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {CARDS_ROW1.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {CARDS_ROW2.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Charts */}
      {daily.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiLineChart
              title="Accepted vs Raw Hours (14 jours)"
              data={daily}
              xKey="date"
              lines={[
                { key: "accepted_hours", label: "Accepted", color: "#10b981" },
                { key: "raw_hours",      label: "Raw",      color: "#3b82f6" },
              ]}
            />
            <KpiLineChart
              title="Gate Pass Rate (14 jours)"
              data={daily}
              xKey="date"
              lines={[{ key: "gate_pass_rate_pct", label: "Gate Pass %", color: "#6366f1" }]}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiBarChart
              title="Downtime par jour (h)"
              data={daily}
              xKey="date"
              bars={[{ key: "downtime_hours", label: "Downtime h", color: "#f87171" }]}
            />
            <KpiLineChart
              title="Uptime % (14 jours)"
              data={daily}
              xKey="date"
              lines={[{ key: "uptime_pct", label: "Uptime %", color: "#f59e0b" }]}
            />
          </div>
        </>
      )}

      {/* Incidents alert */}
      {(ov.critical_incidents_total ?? 0) > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-700">
              {ov.critical_incidents_total} incident{ov.critical_incidents_total > 1 ? "s" : ""} critique{ov.critical_incidents_total > 1 ? "s" : ""} détecté{ov.critical_incidents_total > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-500 mt-0.5">Voir KPIs / Incidents pour le détail</p>
          </div>
        </div>
      )}
    </div>
  );
}
