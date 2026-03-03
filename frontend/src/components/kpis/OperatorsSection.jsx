import { useEffect, useState } from "react";
import { fetchKpiOperators } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import KpiBarChart from "../ui/KpiBarChart";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "operator_id",           label: "Opérateur" },
  { key: "session_count",         label: "Sessions" },
  { key: "raw_hours",             label: "Raw h" },
  { key: "accepted_hours",        label: "Accepted h" },
  { key: "acceptance_rate_pct",   label: "Acc. %",      type: "pct" },
  { key: "gate_pass_rate_pct",    label: "Gate %",      type: "pct" },
  { key: "rejected_pct",          label: "Rej. %",      type: "pct" },
  { key: "rework_pct",            label: "Rework %",    type: "pct" },
  { key: "rework_hours",          label: "Rework h" },
  { key: "defect_rate_pct",       label: "Defect %",    type: "pct" },
  { key: "downtime_hours",        label: "Downtime h" },
  { key: "operating_rate_pct",    label: "Op. Rate %",  type: "pct" },
  { key: "effective_hours",       label: "Eff. h" },
  { key: "capture_efficiency",    label: "Effic." },
];

function avg(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
}

export default function OperatorsSection() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiOperators().then(r => setRows(r.data.operators || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label="Avg Acceptance Rate" value={avg(rows, "acceptance_rate_pct")} unit="%" color="green" />
        <KpiCard label="Avg Gate Pass Rate"  value={avg(rows, "gate_pass_rate_pct")}  unit="%" />
        <KpiCard label="Avg Capture Effic."  value={avg(rows, "capture_efficiency")}  />
      </div>
      <KpiBarChart
        title="Accepted Hours par opérateur"
        data={rows} xKey="operator_id"
        bars={[
          { key: "accepted_hours", label: "Accepted", color: "#10b981" },
          { key: "raw_hours",      label: "Raw",      color: "#93c5fd" },
        ]}
      />
      <KpiTable columns={COLS} rows={rows} />
    </div>
  );
}
