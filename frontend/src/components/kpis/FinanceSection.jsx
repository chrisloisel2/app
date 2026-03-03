import { useEffect, useState } from "react";
import { fetchKpiFinance } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import KpiTable from "../ui/KpiTable";
import KpiLineChart from "../ui/KpiLineChart";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS_DAY = [
  { key: "date",            label: "Date" },
  { key: "rework_cost_eur", label: "Rework €",  type: "eur" },
  { key: "gross_margin_pct", label: "Margin %", type: "pct" },
];
const COLS_SHIFT = [
  { key: "shift",           label: "Shift" },
  { key: "rework_cost_eur", label: "Rework €",  type: "eur" },
];

export default function FinanceSection() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    fetchKpiFinance().then(r => setData(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  const f2 = v => v != null ? +v.toFixed(2) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Cost / Accepted h"  value={f2(data.cost_per_accepted_hour)}  unit="€" />
        <KpiCard label="Cost / Raw h"       value={f2(data.cost_per_raw_hour)}        unit="€" />
        <KpiCard label="Gross Margin"       value={data.gross_margin_pct}             unit="%" color={data.gross_margin_pct > 0 ? "green" : "red"} />
        <KpiCard label="Total Cost"         value={data.total_cost_eur}               unit="€" />
        <KpiCard label="Total Revenue"      value={data.total_revenue_eur}            unit="€" color="green" />
        <KpiCard label="Rework Cost Total"  value={data.rework_cost_eur_total}        unit="€" color={data.rework_cost_eur_total > 0 ? "red" : "green"} />
      </div>
      {(data.by_day||[]).length > 0 && (
        <KpiLineChart
          title="Gross Margin % (par jour)"
          data={data.by_day} xKey="date"
          lines={[{ key: "gross_margin_pct", label: "Margin %", color: "#10b981" }]}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Rework par jour</h3>
          <KpiTable columns={COLS_DAY} rows={data.by_day || []} />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Rework par shift</h3>
          <KpiTable columns={COLS_SHIFT} rows={data.by_shift || []} />
        </div>
      </div>
    </div>
  );
}
