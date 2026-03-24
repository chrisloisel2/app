import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const REFRESH_MS = 5000;

function fmt(v, dec = 1) {
  if (v == null) return null;
  return typeof v === "number" ? +v.toFixed(dec) : v;
}

export default function FinanceSection() {
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

  const rec = data?.recording || {};
  const upl = data?.upload    || {};

  const totalDurationH = fmt((rec.total_duration_s ?? 0) / 3600, 2);
  const avgDurationMin = fmt((rec.avg_duration_s ?? 0) / 60, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Production — indicateurs volumétriques</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live · {data?.date}
        </span>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-700">
        Les KPIs financiers (coût/heure, marge) nécessitent les données de facturation MongoDB. Cette vue présente les indicateurs volumétriques disponibles en temps réel via Kafka.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Sessions démarrées auj." value={rec.started_today}       color="blue" />
        <KpiCard label="Sessions arrêtées auj."  value={rec.stopped_today}       color="green" />
        <KpiCard label="Sessions en cours"       value={rec.active_now}          color={rec.active_now > 0 ? "blue" : "default"} />
        <KpiCard label="Sessions échouées auj."  value={rec.failed_today}        color={rec.failed_today > 0 ? "red" : "green"} />
        <KpiCard label="Durée totale capturée"   value={totalDurationH} unit="h" color="blue" />
        <KpiCard label="Durée moy. par session"  value={avgDurationMin}  unit="min" />
        <KpiCard label="Taux d'échec session"    value={fmt(rec.fail_rate_pct, 1)} unit="%" color={(rec.fail_rate_pct ?? 0) > 10 ? "red" : "green"} />
        <KpiCard label="Uploads complétés"       value={upl.completed_total}     color="green" />
        <KpiCard label="Uploads échoués"         value={upl.failed_total}        color={upl.failed_total > 0 ? "red" : "green"} />
        <KpiCard label="Taux succès upload"      value={fmt(upl.success_rate_pct, 1)} unit="%" color={(upl.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
        <KpiCard label="Durée moy. upload"       value={fmt(upl.avg_elapsed_s, 0)} unit="s" />
        <KpiCard label="En queue"                value={upl.queued_now}          color="amber" />
      </div>
    </div>
  );
}
