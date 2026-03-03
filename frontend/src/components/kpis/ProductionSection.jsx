import { useEffect, useState } from "react";
import { fetchKpiProduction } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "scenario",           label: "Scénario" },
  { key: "session_count",      label: "Sessions" },
  { key: "cycle_time_avg_min", label: "Cycle moy. (min)" },
  { key: "reset_time_avg_min", label: "Reset moy. (min)" },
];

export default function ProductionSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiProduction().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const f = v => v != null ? +v.toFixed(1) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Cycle Time moy."     value={f(data.cycle_time_avg_min)}      unit="min" />
        <KpiCard label="Setup Time moy."     value={f(data.setup_time_avg_min)}      unit="min" />
        <KpiCard label="Capture Time moy."   value={f(data.capture_time_avg_min)}    unit="min" />
        <KpiCard label="Reset Time moy."     value={f(data.reset_time_avg_min)}      unit="min" />
        <KpiCard label="Upload Time moy."    value={f(data.upload_time_avg_min)}     unit="min" />
        <KpiCard label="Capture Efficiency"  value={data.capture_efficiency_global}  color={data.capture_efficiency_global >= 0.8 ? "green" : "amber"} />
      </div>
      {(data.by_scenario||[]).length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase text-gray-500">Par scénario</h3>
          <KpiTable columns={COLS} rows={data.by_scenario} />
        </>
      )}
    </div>
  );
}
