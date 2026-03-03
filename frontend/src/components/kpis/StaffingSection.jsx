import { useEffect, useState } from "react";
import { fetchKpiStaffing } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import KpiBarChart from "../ui/KpiBarChart";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "date",                  label: "Date" },
  { key: "shift",                 label: "Shift" },
  { key: "operators_scheduled",   label: "Prévus" },
  { key: "operators_present",     label: "Présents" },
  { key: "attendance_rate_pct",   label: "Présence %", type: "pct" },
  { key: "effective_hours",       label: "Eff. h" },
];

export default function StaffingSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiStaffing().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const g = data.global || {};
  const byShift = data.by_shift || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Taux de présence"    value={g.attendance_rate_pct}   unit="%" color={g.attendance_rate_pct >= 90 ? "green" : "amber"} />
        <KpiCard label="Heures effectives"   value={g.effective_hours_total} unit="h" />
        <KpiCard label="Turnover %"          value={g.turnover_pct}          unit="%" color={g.turnover_pct > 20 ? "red" : "amber"} />
        <KpiCard label="Heures formation"    value={g.training_hours_total}  unit="h" />
      </div>
      <KpiBarChart
        title="Prévus vs Présents par shift/jour"
        data={byShift} xKey="shift"
        bars={[
          { key: "operators_scheduled", label: "Prévus",   color: "#93c5fd" },
          { key: "operators_present",   label: "Présents", color: "#3b82f6" },
        ]}
      />
      <KpiTable columns={COLS} rows={byShift} />
    </div>
  );
}
