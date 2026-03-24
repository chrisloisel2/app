import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const REFRESH_MS = 5000;

export default function IncidentsSection() {
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

  const dev    = data?.device_faults || {};
  const sta    = data?.stations      || {};
  const counts = data?.event_counts  || {};
  const upl    = data?.upload        || {};

  const activeFaults = dev.active_faults || [];
  const byDevice     = dev.by_device_type || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Incidents — vue live</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
        </span>
      </div>

      {/* Alertes actives */}
      {(dev.active_count > 0 || sta.with_alert_now > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠</span>
          <p className="text-sm font-semibold text-red-700">
            {dev.active_count} panne{dev.active_count !== 1 ? "s" : ""} active{dev.active_count !== 1 ? "s" : ""} · {sta.with_alert_now} station{sta.with_alert_now !== 1 ? "s" : ""} en alerte
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Pannes actives"            value={dev.active_count}          color={dev.active_count > 0 ? "red" : "green"} />
        <KpiCard label="Fréquence pannes (1h)"     value={dev.fault_frequency_1h}    sub="événements" color={dev.fault_frequency_1h > 5 ? "red" : "amber"} />
        <KpiCard label="Stations en alerte"        value={sta.with_alert_now}        color={sta.with_alert_now > 0 ? "red" : "green"} />
        <KpiCard label="Caméras en panne"          value={byDevice.camera  ?? 0}     color={(byDevice.camera  ?? 0) > 0 ? "red" : "green"} />
        <KpiCard label="Grippers en panne"         value={byDevice.gripper ?? 0}     color={(byDevice.gripper ?? 0) > 0 ? "red" : "green"} />
        <KpiCard label="Trackers en panne"         value={byDevice.tracker ?? 0}     color={(byDevice.tracker ?? 0) > 0 ? "red" : "green"} />
        <KpiCard label="Erreurs d'intégrité"       value={counts.session_integrity_error ?? 0} color={(counts.session_integrity_error ?? 0) > 0 ? "red" : "green"} sub="total" />
        <KpiCard label="Alertes station_alert"     value={counts.station_alert ?? 0} sub="depuis démarrage" />
        <KpiCard label="Sessions échouées auj."    value={data?.recording?.failed_today ?? 0} color={(data?.recording?.failed_today ?? 0) > 0 ? "red" : "green"} />
        <KpiCard label="Uploads échoués"           value={upl.failed_total}          color={upl.failed_total > 0 ? "red" : "green"} />
        <KpiCard label="device_fault total"        value={counts.device_fault ?? 0}  sub="depuis démarrage" />
      </div>

      {activeFaults.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Détail des pannes actives</h3>
          <div className="rounded-xl border border-red-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-red-50 text-red-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Station</th>
                  <th className="px-4 py-2 text-left font-semibold">Device</th>
                  <th className="px-4 py-2 text-left font-semibold">ID</th>
                  <th className="px-4 py-2 text-left font-semibold">Fault</th>
                  <th className="px-4 py-2 text-left font-semibold">Détail</th>
                </tr>
              </thead>
              <tbody>
                {activeFaults.map((f, i) => (
                  <tr key={i} className="border-t border-red-100 hover:bg-red-50">
                    <td className="px-4 py-2 font-mono">{f.station_id}</td>
                    <td className="px-4 py-2">{f.device}</td>
                    <td className="px-4 py-2">{f.device_id}</td>
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
