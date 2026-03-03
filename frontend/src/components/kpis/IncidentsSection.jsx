import { useEffect, useState } from "react";
import { fetchKpiIncidents } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS_DAY = [
  { key: "date",                  label: "Date" },
  { key: "critical_incident",     label: "Incident",      type: "bool" },
  { key: "resolution_time_min",   label: "Résolution (min)" },
  { key: "operating_rate_pct",    label: "Op. Rate %",    type: "pct" },
];
const COLS_OP = [
  { key: "operator_id",        label: "Opérateur" },
  { key: "incidents",          label: "Incidents", },
  { key: "operating_rate_pct", label: "Op. Rate %", type: "pct" },
];

export default function IncidentsSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiIncidents().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const total = data.critical_incidents_total ?? 0;

  return (
    <div className="space-y-5">
      {total > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠</span>
          <p className="text-sm font-semibold text-red-700">{total} incident{total > 1 ? "s" : ""} critique{total > 1 ? "s" : ""} détecté{total > 1 ? "s" : ""}</p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label="Incidents critiques" value={total} color={total > 0 ? "red" : "green"} />
        <KpiCard label="Temps résolution moy." value={data.resolution_time_avg_min} unit="min" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Par jour</h3>
          <KpiTable columns={COLS_DAY} rows={data.by_day || []} />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Par opérateur</h3>
          <KpiTable columns={COLS_OP} rows={data.by_operator || []} />
        </div>
      </div>
    </div>
  );
}
