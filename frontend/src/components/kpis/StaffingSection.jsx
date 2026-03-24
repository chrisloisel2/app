import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const REFRESH_MS = 5000;

export default function StaffingSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(() => {
    fetchKafkaKpisLive()
      .then((r) => { setData(r.data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  const sta    = data?.stations     || {};
  const rec    = data?.recording    || {};
  const counts = data?.event_counts || {};

  const presenceRate = sta.total_seen > 0
    ? Math.round((sta.with_operator_now / sta.total_seen) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Présences — vue live</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Stations totales vues"   value={sta.total_seen} />
        <KpiCard label="Stations connectées"     value={sta.connected_now}       color="green" />
        <KpiCard label="Avec opérateur"          value={sta.with_operator_now}   color="blue" />
        <KpiCard label="Taux de présence"        value={presenceRate != null ? `${presenceRate}%` : null} color={(presenceRate ?? 0) >= 70 ? "green" : "amber"} />
        <KpiCard label="Stations en alerte"      value={sta.with_alert_now}      color={sta.with_alert_now > 0 ? "red" : "green"} />
        <KpiCard label="Sessions en cours"       value={rec.active_now}          color={rec.active_now > 0 ? "blue" : "default"} />
        <KpiCard label="Sessions démarrées auj." value={rec.started_today}       color="blue" />
        <KpiCard label="Connexions totales"      value={counts.operator_connected ?? 0} sub="depuis démarrage" />
      </div>
    </div>
  );
}
