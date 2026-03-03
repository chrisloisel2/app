import { useEffect, useState } from "react";
import { fetchKpiDataIntegrity } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "shift",                    label: "Shift" },
  { key: "upload_success_rate_pct",  label: "Upload %",   type: "pct" },
  { key: "data_loss_rate_pct",       label: "Data Loss %", type: "pct" },
  { key: "dataset_completeness_pct", label: "Dataset %",  type: "pct" },
];

export default function DataIntegritySection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiDataIntegrity().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Upload Success"   value={data.upload_success_rate_pct}  unit="%" color={data.upload_success_rate_pct >= 95 ? "green" : "red"} />
        <KpiCard label="Data Loss Rate"   value={data.data_loss_rate_pct}       unit="%" color={data.data_loss_rate_pct > 0 ? "red" : "green"} />
        <KpiCard label="Dataset Compl."   value={data.dataset_completeness_pct} unit="%" color={data.dataset_completeness_pct >= 90 ? "green" : "amber"} />
        <KpiCard label="Latency C→D"      value={data.avg_capture_to_delivery_hours} unit="h" />
        <KpiCard label="QA Backlog"       value={data.qa_backlog_sessions}      color={data.qa_backlog_sessions > 0 ? "amber" : "green"} />
      </div>
      <KpiTable columns={COLS} rows={data.by_shift || []} />
    </div>
  );
}
