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

export default function DataIntegritySection() {
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

  const upl    = data?.upload       || {};
  const counts = data?.event_counts || {};
  const rec    = data?.recording    || {};

  const totalSessions   = (rec.stopped_today ?? 0);
  const failedSessions  = (rec.failed_today  ?? 0);
  const integrityErrors = counts.session_integrity_error ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Intégrité des données — vue live</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Taux succès upload"      value={fmt(upl.success_rate_pct, 1)} unit="%" color={(upl.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
        <KpiCard label="Uploads complétés"       value={upl.completed_total}          color="green" />
        <KpiCard label="Uploads échoués"         value={upl.failed_total}             color={upl.failed_total > 0 ? "red" : "green"} />
        <KpiCard label="En queue"                value={upl.queued_now}               color="amber" />
        <KpiCard label="En cours d'envoi"        value={upl.in_progress_now}          color="blue" />
        <KpiCard label="Durée moy. upload"       value={fmt(upl.avg_elapsed_s, 0)} unit="s" />
        <KpiCard label="Erreurs d'intégrité"     value={integrityErrors}              color={integrityErrors > 0 ? "red" : "green"} sub="total" />
        <KpiCard label="Sessions échouées auj."  value={failedSessions}               color={failedSessions > 0 ? "red" : "green"} />
        <KpiCard label="Sessions arrêtées auj."  value={totalSessions} />
        <KpiCard label="upload_queued total"     value={counts.upload_queued    ?? 0} sub="depuis démarrage" />
        <KpiCard label="upload_completed total"  value={counts.upload_completed ?? 0} sub="depuis démarrage" />
        <KpiCard label="upload_failed total"     value={counts.upload_failed    ?? 0} sub="depuis démarrage" color={(counts.upload_failed ?? 0) > 0 ? "red" : "green"} />
      </div>

      {upl.top_errors && Object.keys(upl.top_errors).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Top erreurs upload</h3>
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
                  <tr key={err} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-700 max-w-xs truncate">{err}</td>
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
