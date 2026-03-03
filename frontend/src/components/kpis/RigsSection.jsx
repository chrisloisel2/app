import { useEffect, useState } from "react";
import { fetchKpiRigs } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import KpiBarChart from "../ui/KpiBarChart";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "rig_id",               label: "Rig" },
  { key: "session_count",        label: "Sessions" },
  { key: "uptime_pct",           label: "Uptime %",   type: "pct" },
  { key: "downtime_hours",       label: "Downtime h" },
  { key: "rig_hours_available",  label: "Heures dispo" },
  { key: "raw_hours",            label: "Raw h" },
  { key: "accepted_hours",       label: "Accepted h" },
];

export default function RigsSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiRigs().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const rigs = data.rigs || [];
  const avgUptime = rigs.length ? +(rigs.reduce((a, r) => a + (r.uptime_pct||0), 0) / rigs.length).toFixed(1) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label="Rigs actifs" value={data.rigs_active_global} sub={`sur ${data.rigs_total_global} total`} />
        <KpiCard label="Avg Uptime" value={avgUptime} unit="%" color={avgUptime >= 85 ? "green" : "amber"} />
        <KpiCard label="Sessions totales" value={rigs.reduce((a, r) => a + r.session_count, 0)} />
      </div>
      <KpiBarChart
        title="Uptime % par rig"
        data={rigs} xKey="rig_id" horizontal
        bars={[{ key: "uptime_pct", label: "Uptime %", color: "#10b981" }]}
      />
      <KpiTable columns={COLS} rows={rigs} />
    </div>
  );
}
