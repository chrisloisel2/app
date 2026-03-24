import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const REFRESH_MS = 5000;

export default function OperatorsSection() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Opérateurs — vue live</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Opérateurs actifs"       value={sta.with_operator_now}  color="blue" />
        <KpiCard label="Stations connectées"     value={sta.connected_now}       color="green" />
        <KpiCard label="Stations en alerte"      value={sta.with_alert_now}      color={sta.with_alert_now > 0 ? "red" : "green"} />
        <KpiCard label="Sessions en cours"       value={rec.active_now}          color={rec.active_now > 0 ? "blue" : "default"} />
        <KpiCard label="Sessions démarrées auj." value={rec.started_today}       color="blue" />
        <KpiCard label="Sessions échouées auj."  value={rec.failed_today}        color={rec.failed_today > 0 ? "red" : "green"} />
        <KpiCard label="Connexions opérateur"    value={counts.operator_connected ?? 0} sub="depuis démarrage" />
        <KpiCard label="Fermetures app"          value={counts.app_closed ?? 0}          sub="depuis démarrage" />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Volume d'événements Kafka</h3>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Type d'événement</th>
                <th className="px-4 py-2 text-right font-semibold w-32">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <tr key={type} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-700">{type}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
