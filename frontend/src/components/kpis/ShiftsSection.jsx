import { useEffect, useState } from "react";
import { fetchKpiShifts } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import KpiBarChart from "../ui/KpiBarChart";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "shift",                    label: "Shift" },
  { key: "session_count",            label: "Sessions" },
  { key: "raw_hours",                label: "Raw h" },
  { key: "accepted_hours",           label: "Accepted h" },
  { key: "acceptance_rate_pct",      label: "Acc. %",        type: "pct" },
  { key: "throughput_h_per_day",     label: "Throughput h/j" },
  { key: "rework_hours",             label: "Rework h" },
  { key: "rework_pct",               label: "Rework %",      type: "pct" },
  { key: "defect_rate_pct",          label: "Defect %",      type: "pct" },
  { key: "upload_success_rate_pct",  label: "Upload %",      type: "pct" },
  { key: "data_loss_rate_pct",       label: "Data Loss %",   type: "pct" },
  { key: "dataset_completeness_pct", label: "Dataset %",     type: "pct" },
  { key: "setup_time_avg_min",       label: "Setup (min)" },
  { key: "rework_cost_eur",          label: "Rework €",      type: "eur" },
];

const SHIFT_COLORS = { morning: "#f59e0b", afternoon: "#3b82f6", night: "#6366f1" };

export default function ShiftsSection() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiShifts().then(r => setRows(r.data.shifts || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  return (
    <div className="space-y-5">
      {/* One card per shift */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {rows.map(r => (
          <div key={r.shift} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{r.shift}</p>
            <p className="text-2xl font-bold text-gray-900">{r.accepted_hours ?? "—"} <span className="text-sm text-gray-400">h accepted</span></p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
              <span>Acc. Rate: <strong>{r.acceptance_rate_pct ?? "—"}%</strong></span>
              <span>Rework: <strong>{r.rework_pct ?? "—"}%</strong></span>
              <span>Sessions: <strong>{r.session_count}</strong></span>
              <span>Rework €: <strong>{r.rework_cost_eur ?? "—"}</strong></span>
            </div>
          </div>
        ))}
      </div>
      <KpiBarChart
        title="Throughput par shift (h/jour)"
        data={rows} xKey="shift"
        bars={[{ key: "throughput_h_per_day", label: "h/jour", color: "#3b82f6" }]}
      />
      <KpiTable columns={COLS} rows={rows} />
    </div>
  );
}
