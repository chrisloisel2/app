import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisHistory } from "../../api/client";
import KpiLineChart from "../ui/KpiLineChart";
import KpiBarChart from "../ui/KpiBarChart";
import KpiTable from "../ui/KpiTable";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const COLS = [
  { key: "ts_iso",              label: "Horodatage" },
  { key: "started_today",       label: "Démarrées" },
  { key: "stopped_today",       label: "Arrêtées" },
  { key: "failed_today",        label: "Échouées" },
  { key: "active_now",          label: "Actives" },
  { key: "avg_duration_s",      label: "Durée moy. (s)" },
  { key: "upload_completed",    label: "Uploads OK" },
  { key: "upload_failed",       label: "Uploads KO" },
  { key: "success_rate_pct",    label: "Taux succès %", type: "pct" },
  { key: "fault_count",         label: "Pannes actives" },
  { key: "tracker_availability",label: "Trackers %",    type: "pct" },
  { key: "stations_connected",  label: "Stations conn." },
];

function buildRows(snapshots) {
  return snapshots.map((s) => ({
    ts_iso:               s.ts_iso?.slice(0, 19).replace("T", " ") ?? "",
    started_today:        s.kpis?.recording?.started_today ?? 0,
    stopped_today:        s.kpis?.recording?.stopped_today ?? 0,
    failed_today:         s.kpis?.recording?.failed_today  ?? 0,
    active_now:           s.kpis?.recording?.active_now    ?? 0,
    avg_duration_s:       s.kpis?.recording?.avg_duration_s ?? null,
    upload_completed:     s.kpis?.upload?.completed_total   ?? 0,
    upload_failed:        s.kpis?.upload?.failed_total      ?? 0,
    success_rate_pct:     s.kpis?.upload?.success_rate_pct  ?? null,
    fault_count:          s.kpis?.device_faults?.active_count ?? 0,
    tracker_availability: s.kpis?.trackers?.availability_pct ?? null,
    stations_connected:   s.kpis?.stations?.connected_now   ?? 0,
    _ts: s.ts,
  }));
}

export default function DailySection() {
  const [hours, setHours]     = useState(24);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchKafkaKpisHistory(hours, 500)
      .then((r) => {
        const snaps = r.data.snapshots || [];
        // chronological order for charts
        setRows(buildRows([...snaps].reverse()));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const chartData = rows.map((r) => ({ ...r, date: r.ts_iso }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Historique Kafka — snapshots</h2>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          {[1, 6, 12, 24, 48, 72].map((h) => (
            <option key={h} value={h}>{h}h</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : error ? <ErrorBanner message={error} /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiLineChart
              title="Sessions démarrées / arrêtées"
              data={chartData} xKey="date"
              lines={[
                { key: "started_today", label: "Démarrées", color: "#3b82f6" },
                { key: "stopped_today", label: "Arrêtées",  color: "#10b981" },
                { key: "failed_today",  label: "Échouées",  color: "#f87171" },
              ]}
            />
            <KpiLineChart
              title="Taux de succès upload %"
              data={chartData} xKey="date"
              lines={[{ key: "success_rate_pct", label: "Succès %", color: "#6366f1" }]}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiBarChart
              title="Pannes actives"
              data={chartData} xKey="date"
              bars={[{ key: "fault_count", label: "Pannes", color: "#f87171" }]}
            />
            <KpiLineChart
              title="Disponibilité trackers %"
              data={chartData} xKey="date"
              lines={[{ key: "tracker_availability", label: "Trackers %", color: "#f59e0b" }]}
            />
          </div>
          <KpiTable columns={COLS} rows={rows} />
        </>
      )}
    </div>
  );
}
