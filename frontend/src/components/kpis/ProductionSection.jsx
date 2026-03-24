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

export default function ProductionSection() {
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

  const rec    = data?.recording    || {};
  const upl    = data?.upload       || {};
  const trk    = data?.trackers     || {};
  const dev    = data?.device_faults || {};
  const sta    = data?.stations     || {};
  const counts = data?.event_counts || {};

  const totalDurationH = fmt((rec.total_duration_s ?? 0) / 3600, 2);

  // Productivité : sessions terminées / stations connectées
  const productivity = sta.connected_now > 0
    ? fmt(rec.stopped_today / sta.connected_now, 2)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Production — capacité live</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live · {data?.date}
        </span>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Capture</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard label="Sessions démarrées"    value={rec.started_today}               color="blue" />
          <KpiCard label="Sessions arrêtées"     value={rec.stopped_today}               color="green" />
          <KpiCard label="Sessions en cours"     value={rec.active_now}                  color={rec.active_now > 0 ? "blue" : "default"} />
          <KpiCard label="Sessions échouées"     value={rec.failed_today}                color={rec.failed_today > 0 ? "red" : "green"} />
          <KpiCard label="Durée totale capturée" value={totalDurationH}    unit="h"      color="blue" />
          <KpiCard label="Durée moy. session"    value={fmt(rec.avg_duration_s, 0)} unit="s" />
          <KpiCard label="Taux d'échec"          value={fmt(rec.fail_rate_pct, 1)}  unit="%" color={(rec.fail_rate_pct ?? 0) > 10 ? "red" : "green"} />
          <KpiCard label="Sessions / station"    value={productivity} sub="arrêtées / connectées" />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Livraison</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard label="Uploads complétés"     value={upl.completed_total}             color="green" />
          <KpiCard label="Uploads échoués"       value={upl.failed_total}               color={upl.failed_total > 0 ? "red" : "green"} />
          <KpiCard label="En queue"              value={upl.queued_now}                  color="amber" />
          <KpiCard label="En cours"              value={upl.in_progress_now}             color="blue" />
          <KpiCard label="Taux succès upload"    value={fmt(upl.success_rate_pct, 1)} unit="%" color={(upl.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
          <KpiCard label="Durée moy. upload"     value={fmt(upl.avg_elapsed_s, 0)} unit="s" />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Infrastructure</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard label="Stations connectées"   value={sta.connected_now}               color="green" />
          <KpiCard label="Avec opérateur"        value={sta.with_operator_now}           color="blue" />
          <KpiCard label="Stations en alerte"    value={sta.with_alert_now}             color={sta.with_alert_now > 0 ? "red" : "green"} />
          <KpiCard label="Pannes actives"        value={dev.active_count}               color={dev.active_count > 0 ? "red" : "green"} />
          <KpiCard label="Trackers connectés"    value={trk.total_connected} />
          <KpiCard label="Trackers en tracking"  value={trk.tracking_now}               color="green" />
          <KpiCard label="Disponibilité trackers" value={fmt(trk.availability_pct, 1)} unit="%" color={(trk.availability_pct ?? 100) >= 90 ? "green" : "amber"} />
          <KpiCard label="Batterie faible"       value={trk.low_battery_now}            color={trk.low_battery_now > 0 ? "amber" : "green"} />
        </div>
      </div>
    </div>
  );
}
