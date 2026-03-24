import { useEffect, useState, useCallback } from "react";
import { fetchKafkaKpisLive } from "../api/client";
import KpiCard from "../components/ui/KpiCard";
import KpiLineChart from "../components/ui/KpiLineChart";
import KpiBarChart from "../components/ui/KpiBarChart";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorBanner from "../components/ui/ErrorBanner";

const REFRESH_MS = 5000;

function fmt(v, dec = 1) {
  if (v == null) return null;
  return typeof v === "number" ? +v.toFixed(dec) : v;
}

export default function DashboardPage() {
  const [data, setData]     = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [lastTs, setLastTs] = useState(null);

  const load = useCallback(() => {
    fetchKafkaKpisLive()
      .then((r) => {
        const d = r.data;
        setData(d);
        setLastTs(new Date().toLocaleTimeString());
        setError(null);
        // Append snapshot to local history for sparklines (max 60 points)
        setHistory((prev) => {
          const next = [...prev, { ...d, _label: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }];
          return next.slice(-60);
        });
      })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <LoadingSpinner text="Chargement du dashboard…" />;
  if (error)   return <div className="p-6"><ErrorBanner message={error} /></div>;

  const rec = data?.recording     || {};
  const upl = data?.upload        || {};
  const dev = data?.device_faults || {};
  const trk = data?.trackers      || {};
  const sta = data?.stations      || {};

  const CARDS_ROW1 = [
    { label: "Sessions en cours",     value: rec.active_now,                     color: rec.active_now > 0 ? "blue" : "default" },
    { label: "Démarrées auj.",        value: rec.started_today,                  color: "blue" },
    { label: "Arrêtées auj.",         value: rec.stopped_today,                  color: "green" },
    { label: "Échouées auj.",         value: rec.failed_today,                   color: rec.failed_today > 0 ? "red" : "green" },
    { label: "Durée moy. session",    value: fmt(rec.avg_duration_s, 0), unit: "s" },
    { label: "Taux d'échec",          value: fmt(rec.fail_rate_pct, 1),  unit: "%", color: (rec.fail_rate_pct ?? 0) > 10 ? "red" : "green" },
  ];
  const CARDS_ROW2 = [
    { label: "Taux succès upload",    value: fmt(upl.success_rate_pct, 1), unit: "%", color: (upl.success_rate_pct ?? 100) >= 95 ? "green" : "red" },
    { label: "Uploads complétés",     value: upl.completed_total,          color: "green" },
    { label: "Uploads échoués",       value: upl.failed_total,             color: upl.failed_total > 0 ? "red" : "green" },
    { label: "En queue",              value: upl.queued_now,               color: "amber" },
    { label: "Pannes actives",        value: dev.active_count,             color: dev.active_count > 0 ? "red" : "green" },
    { label: "Stations connectées",   value: sta.connected_now,            color: "green" },
  ];
  const CARDS_ROW3 = [
    { label: "Trackers connectés",    value: trk.total_connected },
    { label: "En tracking",           value: trk.tracking_now,             color: "green" },
    { label: "Disponibilité trackers",value: fmt(trk.availability_pct, 1), unit: "%", color: (trk.availability_pct ?? 100) >= 90 ? "green" : "amber" },
    { label: "Batterie faible",       value: trk.low_battery_now,          color: trk.low_battery_now > 0 ? "amber" : "green" },
    { label: "Avec opérateur",        value: sta.with_operator_now,        color: "blue" },
    { label: "Stations en alerte",    value: sta.with_alert_now,           color: sta.with_alert_now > 0 ? "red" : "green" },
  ];

  // Chart data from rolling history
  const chartData = history.map((h) => ({
    date:              h._label,
    active_now:        h.recording?.active_now        ?? 0,
    started_today:     h.recording?.started_today     ?? 0,
    success_rate_pct:  h.upload?.success_rate_pct     ?? null,
    fault_count:       h.device_faults?.active_count  ?? 0,
    tracker_avail:     h.trackers?.availability_pct   ?? null,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Physical Data — Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Données temps réel · Kafka · mise à jour toutes les {REFRESH_MS / 1000}s</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live{lastTs && ` · ${lastTs}`}
        </span>
      </div>

      {/* Alertes actives */}
      {(dev.active_count > 0 || sta.with_alert_now > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-700">
              {dev.active_count} panne{dev.active_count !== 1 ? "s" : ""} active{dev.active_count !== 1 ? "s" : ""} · {sta.with_alert_now} station{sta.with_alert_now !== 1 ? "s" : ""} en alerte
            </p>
            <p className="text-xs text-red-500 mt-0.5">Voir KPIs / Incidents pour le détail</p>
          </div>
        </div>
      )}

      {/* Enregistrement */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Enregistrement</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CARDS_ROW1.map((c) => <KpiCard key={c.label} {...c} />)}
        </div>
      </div>

      {/* Upload */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upload & Pannes</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CARDS_ROW2.map((c) => <KpiCard key={c.label} {...c} />)}
        </div>
      </div>

      {/* Trackers & Stations */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Trackers & Stations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CARDS_ROW3.map((c) => <KpiCard key={c.label} {...c} />)}
        </div>
      </div>

      {/* Charts (rolling 60 snapshots) */}
      {chartData.length > 1 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <KpiLineChart
              title="Sessions actives (glissant)"
              data={chartData} xKey="date"
              lines={[
                { key: "active_now",    label: "En cours",    color: "#3b82f6" },
                { key: "started_today", label: "Démarrées",   color: "#10b981" },
              ]}
            />
            <KpiLineChart
              title="Taux succès upload %"
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
              lines={[{ key: "tracker_avail", label: "Trackers %", color: "#f59e0b" }]}
            />
          </div>
        </>
      )}
    </div>
  );
}
