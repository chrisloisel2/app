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

export default function OverviewSection() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastTs, setLastTs]   = useState(null);

  const load = useCallback(() => {
    fetchKafkaKpisLive()
      .then((r) => {
        setData(r.data);
        setLastTs(new Date().toLocaleTimeString());
        setError(null);
      })
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

  const rec = data?.recording   || {};
  const upl = data?.upload      || {};
  const dev = data?.device_faults || {};
  const trk = data?.trackers    || {};
  const sta = data?.stations    || {};

  const groups = [
    {
      title: "Enregistrement — aujourd'hui",
      cards: [
        { label: "Sessions démarrées",    value: rec.started_today,       color: "blue" },
        { label: "Sessions arrêtées",     value: rec.stopped_today,       color: "green" },
        { label: "Sessions en cours",     value: rec.active_now,          color: rec.active_now > 0 ? "blue" : "default" },
        { label: "Échecs aujourd'hui",    value: rec.failed_today,        color: rec.failed_today > 0 ? "red" : "green" },
        { label: "Durée moyenne",         value: fmt(rec.avg_duration_s, 1), unit: "s" },
        { label: "Taux d'échec",          value: fmt(rec.fail_rate_pct, 1),  unit: "%", color: (rec.fail_rate_pct ?? 0) > 10 ? "red" : "green" },
      ],
    },
    {
      title: "Upload",
      cards: [
        { label: "Complétés",             value: upl.completed_total,     color: "green" },
        { label: "Échoués",               value: upl.failed_total,        color: upl.failed_total > 0 ? "red" : "green" },
        { label: "En queue",              value: upl.queued_now,          color: "amber" },
        { label: "En cours",              value: upl.in_progress_now,     color: "blue" },
        { label: "Taux de succès",        value: fmt(upl.success_rate_pct, 1), unit: "%", color: (upl.success_rate_pct ?? 100) >= 95 ? "green" : "red" },
        { label: "Durée moyenne",         value: fmt(upl.avg_elapsed_s, 0),    unit: "s" },
      ],
    },
    {
      title: "Pannes matérielles",
      cards: [
        { label: "Pannes actives",        value: dev.active_count,        color: dev.active_count > 0 ? "red" : "green" },
        { label: "Caméras en panne",      value: dev.by_device_type?.camera   ?? 0, color: (dev.by_device_type?.camera ?? 0) > 0 ? "red" : "green" },
        { label: "Grippers en panne",     value: dev.by_device_type?.gripper  ?? 0, color: (dev.by_device_type?.gripper ?? 0) > 0 ? "red" : "green" },
        { label: "Trackers en panne",     value: dev.by_device_type?.tracker  ?? 0, color: (dev.by_device_type?.tracker ?? 0) > 0 ? "red" : "green" },
        { label: "Fréquence pannes 1h",   value: dev.fault_frequency_1h,  sub: "événements" },
      ],
    },
    {
      title: "Trackers VR",
      cards: [
        { label: "Connectés",             value: trk.total_connected },
        { label: "En tracking",           value: trk.tracking_now,        color: "green" },
        { label: "Disponibilité",         value: fmt(trk.availability_pct, 1), unit: "%", color: (trk.availability_pct ?? 100) >= 90 ? "green" : "amber" },
        { label: "Batterie faible",       value: trk.low_battery_now,     color: trk.low_battery_now > 0 ? "amber" : "green" },
        { label: "Evt batterie faible",   value: trk.low_battery_events_total,  sub: "total session" },
        { label: "Evt batterie critique", value: trk.crit_battery_events_total, sub: "total session", color: trk.crit_battery_events_total > 0 ? "red" : "green" },
      ],
    },
    {
      title: "Stations",
      cards: [
        { label: "Stations vues",         value: sta.total_seen },
        { label: "Connectées",            value: sta.connected_now,       color: "green" },
        { label: "Avec opérateur",        value: sta.with_operator_now,   color: "blue" },
        { label: "En alerte",             value: sta.with_alert_now,      color: sta.with_alert_now > 0 ? "red" : "green" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Données temps réel — mise à jour toutes les {REFRESH_MS / 1000}s
          {lastTs && <> · dernière sync : {lastTs}</>}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {groups.map(({ title, cards }) => (
        <div key={title}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {cards.map((c) => <KpiCard key={c.label} {...c} />)}
          </div>
        </div>
      ))}

      {/* Top erreurs upload */}
      {upl.top_errors && Object.keys(upl.top_errors).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Top erreurs upload</h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Erreur</th>
                  <th className="px-4 py-2 text-right font-semibold w-20">Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(upl.top_errors).map(([err, count]) => (
                  <tr key={err} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-700 font-mono">{err}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-semibold">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pannes actives */}
      {dev.active_faults?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pannes actives</h2>
          <div className="rounded-xl border border-red-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-red-50 text-red-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Station</th>
                  <th className="px-4 py-2 text-left font-semibold">Device</th>
                  <th className="px-4 py-2 text-left font-semibold">Fault</th>
                  <th className="px-4 py-2 text-left font-semibold">Détail</th>
                </tr>
              </thead>
              <tbody>
                {dev.active_faults.map((f, i) => (
                  <tr key={i} className="border-t border-red-100">
                    <td className="px-4 py-2 font-mono text-gray-700">{f.station_id}</td>
                    <td className="px-4 py-2 text-gray-600">{f.device} / {f.device_id}</td>
                    <td className="px-4 py-2 text-red-600 font-semibold">{f.fault}</td>
                    <td className="px-4 py-2 text-gray-500">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
