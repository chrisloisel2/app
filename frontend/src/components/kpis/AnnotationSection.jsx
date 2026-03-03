import { useEffect, useState } from "react";
import { fetchKpiAnnotation } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "annotator_id",              label: "Annotateur" },
  { key: "session_count",             label: "Sessions" },
  { key: "label_completeness_pct",    label: "Complétude %",  type: "pct" },
  { key: "label_accuracy_pct",        label: "Exactitude %",  type: "pct" },
  { key: "inter_annotator_agreement", label: "IAA" },
  { key: "annotation_time_avg_min",   label: "Temps moy. (min)" },
];

export default function AnnotationSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiAnnotation().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const g = data.global || {};
  const annotators = data.annotators || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Label Complétude"  value={g.label_completeness_pct} unit="%" color={g.label_completeness_pct >= 90 ? "green" : "amber"} />
        <KpiCard label="Label Exactitude"  value={g.label_accuracy_pct}     unit="%" color={g.label_accuracy_pct >= 95 ? "green" : "amber"} />
        <KpiCard label="Annotateurs"       value={annotators.length} />
        <KpiCard label="Sessions annotées" value={annotators.reduce((a, r) => a + (r.session_count||0), 0)} />
      </div>
      <KpiTable columns={COLS} rows={annotators} />
    </div>
  );
}
