import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../../api/client";
import KpiCard from "../ui/KpiCard";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorBanner from "../ui/ErrorBanner";

const REFRESH_MS = 5000;

export default function AnnotationSection() {
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

  const counts = data?.event_counts || {};
  const rec    = data?.recording    || {};
  const upl    = data?.upload       || {};

  // Indicateurs de qualité dérivés des événements
  const totalSessions  = rec.stopped_today ?? 0;
  const failedSessions = rec.failed_today  ?? 0;
  const successSessions = Math.max(0, totalSessions - failedSessions);
  const integrityErrors = counts.session_integrity_error ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Qualité — indicateurs Kafka</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Sessions réussies auj."  value={successSessions}        color="green" />
        <KpiCard label="Sessions échouées auj."  value={failedSessions}         color={failedSessions > 0 ? "red" : "green"} />
        <KpiCard label="Erreurs d'intégrité"     value={integrityErrors}        color={integrityErrors > 0 ? "red" : "green"} sub="total session" />
        <KpiCard label="Uploads complétés"       value={upl.completed_total}    color="green" />
        <KpiCard label="Uploads échoués"         value={upl.failed_total}       color={upl.failed_total > 0 ? "red" : "green"} />
        <KpiCard label="Taux succès upload"      value={upl.success_rate_pct != null ? `${upl.success_rate_pct}%` : null} color={(upl.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
        <KpiCard label="session_failed reçus"    value={counts.session_failed ?? 0}           sub="depuis démarrage" />
        <KpiCard label="recording_stopped reçus" value={counts.recording_stopped ?? 0}        sub="depuis démarrage" />
      </div>

      {upl.top_errors && Object.keys(upl.top_errors).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Erreurs upload récurrentes</h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Message d'erreur</th>
                  <th className="px-4 py-2 text-right font-semibold w-28">Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(upl.top_errors).map(([err, count]) => (
                  <tr key={err} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-mono text-gray-700">{err}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-semibold">{count}</td>
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
