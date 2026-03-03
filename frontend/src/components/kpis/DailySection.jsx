import { useEffect, useState } from "react";
import { fetchKpiDaily } from "../../api/client";
import KpiLineChart from "../ui/KpiLineChart";
import KpiBarChart from "../ui/KpiBarChart";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "date",                   label: "Date" },
  { key: "sessions",               label: "Sessions" },
  { key: "accepted_hours",         label: "Accepted h" },
  { key: "raw_hours",              label: "Raw h" },
  { key: "acceptance_rate_pct",    label: "Acc. %",    type: "pct" },
  { key: "gate_pass_rate_pct",     label: "Gate %",    type: "pct" },
  { key: "rejected_pct",           label: "Rej. %",    type: "pct" },
  { key: "uptime_pct",             label: "Uptime %",  type: "pct" },
  { key: "downtime_hours",         label: "Downtime h" },
  { key: "rework_hours",           label: "Rework h" },
  { key: "rigs_active",            label: "Rigs" },
  { key: "attendance_rate_pct",    label: "Présence %", type: "pct" },
  { key: "upload_success_rate_pct", label: "Upload %", type: "pct" },
  { key: "critical_incident",      label: "Incident",  type: "bool" },
  { key: "gross_margin_pct",       label: "Margin %",  type: "pct" },
];

export default function DailySection() {
  const [days, setDays]     = useState(30);
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchKpiDaily(days)
      .then(r => setData(r.data.days || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Évolution Journalière</h2>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          {[7, 14, 30, 90].map(d => <option key={d} value={d}>{d} jours</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : error ? <ErrorBanner message={error} /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiLineChart title="Accepted vs Raw Hours"
              data={data} xKey="date"
              lines={[
                { key: "accepted_hours", label: "Accepted", color: "#10b981" },
                { key: "raw_hours",      label: "Raw",      color: "#3b82f6" },
              ]}
            />
            <KpiLineChart title="Gate Pass Rate %"
              data={data} xKey="date"
              lines={[{ key: "gate_pass_rate_pct", label: "Gate Pass %", color: "#6366f1" }]}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiBarChart title="Downtime (h/jour)"
              data={data} xKey="date"
              bars={[{ key: "downtime_hours", label: "Downtime h", color: "#f87171" }]}
            />
            <KpiLineChart title="Uptime %"
              data={data} xKey="date"
              lines={[{ key: "uptime_pct", label: "Uptime %", color: "#f59e0b" }]}
            />
          </div>
          <KpiTable columns={COLS} rows={data} />
        </>
      )}
    </div>
  );
}
