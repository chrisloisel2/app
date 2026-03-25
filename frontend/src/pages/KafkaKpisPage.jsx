import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchKafkaOperators,
  fetchKafkaOperatorDetail,
  fetchKafkaOperatorsDb,
} from "../api/client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import KpiCard from "../components/ui/KpiCard";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorBanner from "../components/ui/ErrorBanner";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f87171","#a3e635","#fb923c","#818cf8"];

const TABS = ["Aperçu", "Opérateurs", "Sessions en attente"];

function fmt(v, dec = 1) {
  if (v == null || v === undefined) return "—";
  if (typeof v === "number") return +v.toFixed(dec);
  return v;
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {title && <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>}
      {children}
    </div>
  );
}

// ── Onglet Aperçu ─────────────────────────────────────────────────────────────
function AperçuTab() {
  const [snap, setSnap]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimer = null;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/api/kafka-kpis/ws`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          setSnap(JSON.parse(e.data));
          setLoading(false);
          setError(null);
        } catch (_) {}
      };

      ws.onerror = () => setError("WebSocket erreur");

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;
  if (!snap)   return null;

  const rec = snap.recording  || {};
  const upl = snap.upload     || {};
  const ses = snap.sessions   || {};
  const sta = snap.stations   || {};
  const trk = snap.trackers   || {};
  const dev = snap.device_faults || {};

  const leaderboard = snap.operators_leaderboard || [];

  return (
    <div className="space-y-6">
      {/* Enregistrements */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Enregistrements — aujourd'hui</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Démarrés"     value={rec.started_today}   color="blue" />
          <KpiCard label="Terminés"     value={rec.stopped_today}   color="green" />
          <KpiCard label="Échoués"      value={rec.failed_today}    color={rec.failed_today > 0 ? "red" : "default"} />
          <KpiCard label="En cours"     value={rec.active_now}      color="blue" />
          <KpiCard label="Durée moy."   value={fmt(rec.avg_duration_s, 0)} unit="s" />
          <KpiCard label="Total capturé"value={fmt(rec.total_duration_h, 2)} unit="h" color="green" />
          <KpiCard label="Taux échec"   value={fmt(rec.fail_rate_pct, 1)}   unit="%" color={rec.fail_rate_pct > 5 ? "red" : "default"} />
        </div>
      </div>

      {/* Sessions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Sessions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Total all-time"    value={ses.total_all_time ?? ses.total_seen} color="blue" />
          <KpiCard label="Session courante"  value={ses.total_seen}      />
          <KpiCard label="En attente upload" value={ses.pending_upload}  color={ses.pending_upload > 0 ? "amber" : "green"} />
          <KpiCard label="Uploadées"         value={ses.uploaded}        color="green" />
          <KpiCard label="Heures totales"    value={fmt(ses.total_duration_h, 2)} unit="h" color="blue" />
        </div>
      </div>

      {/* Upload */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Upload</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Complétés"    value={upl.completed_total}  color="green" />
          <KpiCard label="Échoués"      value={upl.failed_total}     color={upl.failed_total > 0 ? "red" : "default"} />
          <KpiCard label="En queue"     value={upl.queued_now}       />
          <KpiCard label="En cours"     value={upl.in_progress_now}  color="blue" />
          <KpiCard label="Taux succès"  value={fmt(upl.success_rate_pct, 1)} unit="%" color={(upl.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
          <KpiCard label="Durée moy."   value={fmt(upl.avg_elapsed_s, 0)} unit="s" />
        </div>
      </div>

      {/* Infra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Stations / Trackers">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Stations vues"   value={sta.total_seen}        />
            <KpiCard label="Connectées"      value={sta.connected_now}     color="green" />
            <KpiCard label="Avec opérateur"  value={sta.with_operator_now} />
            <KpiCard label="En alerte"       value={sta.with_alert_now}    color={sta.with_alert_now > 0 ? "red" : "default"} />
            <KpiCard label="Trackers"        value={trk.total_connected}   />
            <KpiCard label="Tracking actif"  value={trk.tracking_now}      />
            <KpiCard label="Dispo trackers"  value={fmt(trk.availability_pct, 1)} unit="%" />
            <KpiCard label="Bat. faible"     value={trk.low_battery_now}   color={trk.low_battery_now > 0 ? "amber" : "default"} />
          </div>
        </Card>

        <Card title="Pannes actives">
          {dev.active_count === 0 ? (
            <p className="text-sm text-green-600 font-semibold">Aucune panne active</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-semibold">{dev.active_count} panne(s)</p>
              {(dev.active_faults || []).map((f, i) => (
                <div key={i} className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="font-semibold">{f.station_id}</span> — {f.device}/{f.device_id} : <span className="text-red-700">{f.fault}</span>
                  {f.detail && <p className="text-gray-500 mt-0.5">{f.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Leaderboard opérateurs */}
      {leaderboard.length > 0 && (
        <Card title="Top opérateurs (sessions enregistrées)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Opérateur</th>
                  <th className="px-3 py-2 text-right">Sessions</th>
                  <th className="px-3 py-2 text-right">Heures</th>
                  <th className="px-3 py-2 text-right">Échouées</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((op, i) => (
                  <tr key={op.operator} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold flex items-center gap-2">
                      <span className="text-gray-400 w-4">{i + 1}</span>
                      {op.operator || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{op.sessions}</td>
                    <td className="px-3 py-2 text-right">{fmt(op.duration_h, 2)}</td>
                    <td className={`px-3 py-2 text-right ${op.failed > 0 ? "text-red-500" : "text-gray-400"}`}>{op.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Onglet Opérateurs ─────────────────────────────────────────────────────────
function OperateursTab() {
  const [summary, setSummary]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [dbRows, setDbRows]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError]         = useState(null);
  const [groupBy, setGroupBy]     = useState("day");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchKafkaOperators(),
      fetchKafkaOperatorsDb({ group_by: groupBy }),
    ])
      .then(([r1, r2]) => {
        setSummary(r1.data.summary || []);
        setDbRows(r2.data.rows     || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [groupBy]);

  const loadDetail = (op) => {
    setSelected(op);
    setLoadingDetail(true);
    fetchKafkaOperatorDetail(op)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  };

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  // Préparer les données de chart pour l'opérateur sélectionné
  const byDayChart  = detail ? Object.entries(detail.by_day || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, sessions: v.sessions, duration_h: v.duration_h, failed: v.failed }))
    : [];

  const byHourChart = detail ? Array.from({ length: 24 }, (_, h) => {
    const v = detail.by_hour?.[h] || detail.by_hour?.[String(h)] || {};
    return { label: `${h.toString().padStart(2, "0")}h`, sessions: v.sessions || 0, duration_h: v.duration_h || 0 };
  }) : [];

  const byMonthChart = detail ? Object.entries(detail.by_month || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, sessions: v.sessions, duration_h: v.duration_h, failed: v.failed }))
    : [];

  return (
    <div className="space-y-6">
      {/* Résumé in-memory */}
      {summary.length > 0 && (
        <Card title="Opérateurs — session courante (depuis démarrage backend)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Opérateur</th>
                  <th className="px-3 py-2 text-right">Sessions</th>
                  <th className="px-3 py-2 text-right">Heures</th>
                  <th className="px-3 py-2 text-right">Échouées</th>
                  <th className="px-3 py-2 text-right">Taux échec</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {summary.map((op) => (
                  <tr key={op.operator}
                    className={`border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors
                      ${selected === op.operator ? "bg-blue-50" : ""}`}
                    onClick={() => loadDetail(op.operator)}>
                    <td className="px-3 py-2 font-semibold">{op.operator || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{op.total_sessions}</td>
                    <td className="px-3 py-2 text-right">{fmt(op.total_duration_h, 2)}</td>
                    <td className={`px-3 py-2 text-right ${op.total_failed > 0 ? "text-red-500" : "text-gray-400"}`}>{op.total_failed}</td>
                    <td className={`px-3 py-2 text-right ${(op.fail_rate_pct || 0) > 10 ? "text-red-500" : "text-gray-500"}`}>
                      {fmt(op.fail_rate_pct, 1)}%
                    </td>
                    <td className="px-3 py-2 text-blue-500 text-right">↗</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Détail opérateur sélectionné */}
      {selected && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-base font-bold text-gray-800">Détail : {selected}</p>
            {loadingDetail && <span className="text-xs text-gray-400">Chargement...</span>}
            {detail && (
              <div className="flex gap-4 ml-auto text-xs text-gray-500">
                <span className="font-semibold text-blue-600">{detail.total_sessions} sessions</span>
                <span className="font-semibold text-green-600">{fmt(detail.total_duration_h, 2)} h</span>
                {detail.total_failed > 0 && <span className="font-semibold text-red-500">{detail.total_failed} échouées</span>}
              </div>
            )}
          </div>

          {detail && byDayChart.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Sessions par jour">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byDayChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sessions" name="Sessions" fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="failed"   name="Échouées" fill="#f87171" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Heures générées par jour">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={byDayChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} h`]} />
                    <Line type="monotone" dataKey="duration_h" name="Heures" stroke="#10b981" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Sessions par heure de la journée">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byHourChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="sessions" name="Sessions" radius={[3,3,0,0]}>
                      {byHourChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Heures par heure de la journée">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byHourChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} h`]} />
                    <Bar dataKey="duration_h" name="Heures" fill="#8b5cf6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {byMonthChart.length > 0 && (
                <Card title="Heures générées par mois">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byMonthChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} h`]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="duration_h" name="Heures" fill="#06b6d4" radius={[3,3,0,0]} />
                      <Bar dataKey="failed"     name="Échouées" fill="#f87171" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique MongoDB */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Historique MongoDB (toutes sessions)</p>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600">
            <option value="day">Par jour</option>
            <option value="month">Par mois</option>
            <option value="operator">Par opérateur</option>
          </select>
        </div>
        {dbRows.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune donnée persistée en base.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    {groupBy !== "operator" && groupBy !== "month" && <th className="px-3 py-2 text-left">Date</th>}
                    {groupBy === "month" && <th className="px-3 py-2 text-left">Mois</th>}
                    <th className="px-3 py-2 text-left">Opérateur</th>
                    <th className="px-3 py-2 text-right">Sessions</th>
                    <th className="px-3 py-2 text-right">Heures</th>
                    <th className="px-3 py-2 text-right">Échouées</th>
                    <th className="px-3 py-2 text-right">Taux échec</th>
                  </tr>
                </thead>
                <tbody>
                  {dbRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      {groupBy !== "operator" && groupBy !== "month" && <td className="px-3 py-2 font-mono text-gray-600">{row.date}</td>}
                      {groupBy === "month" && <td className="px-3 py-2 font-mono text-gray-600">{row.month}</td>}
                      <td className="px-3 py-2 font-semibold">{row.operator || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.sessions}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.duration_h, 3)}</td>
                      <td className={`px-3 py-2 text-right ${row.failed > 0 ? "text-red-500" : "text-gray-400"}`}>{row.failed ?? "—"}</td>
                      <td className={`px-3 py-2 text-right ${(row.fail_rate_pct || 0) > 10 ? "text-red-500" : "text-gray-400"}`}>
                        {row.fail_rate_pct != null ? `${row.fail_rate_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet Sessions en attente ────────────────────────────────────────────────
function PendingTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const wsRef = useRef(null);
  const fetchPendingRef = useRef(null);

  const fetchPending = useCallback(() => {
    fetch("/api/kafka-kpis/sessions/pending")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); setError(null); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchPendingRef.current = fetchPending;
  }, [fetchPending]);

  useEffect(() => {
    let reconnectTimer = null;
    let throttleTimer = null;

    fetchPending();

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/api/kafka-kpis/ws`);
      wsRef.current = ws;

      ws.onmessage = () => {
        // Throttle: re-fetch pending list max 1x/s
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            fetchPendingRef.current?.();
            throttleTimer = null;
          }, 1000);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      clearTimeout(throttleTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchPending]);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorBanner message={error} />;

  const sessions = data?.sessions || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard label="En attente"    value={data?.count}            color={data?.count > 0 ? "amber" : "green"} />
        <KpiCard label="Durée totale"  value={fmt(data?.total_duration_h, 2)} unit="h" />
      </div>

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-green-600 font-semibold">Aucune session en attente d'upload.</p>
        </Card>
      ) : (
        <Card title={`${sessions.length} session(s) sur les postes — pas encore uploadées`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Session ID</th>
                  <th className="px-3 py-2 text-left">Station</th>
                  <th className="px-3 py-2 text-left">Opérateur</th>
                  <th className="px-3 py-2 text-left">Scénario</th>
                  <th className="px-3 py-2 text-right">Durée</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-600">{s.session_id}</td>
                    <td className="px-3 py-2">{s.station_id || "—"}</td>
                    <td className="px-3 py-2 font-semibold">{s.operator || "—"}</td>
                    <td className="px-3 py-2">{s.scenario || "—"}</td>
                    <td className="px-3 py-2 text-right">{s.duration_s ? `${s.duration_s.toFixed(0)}s` : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                        ${s.failed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {s.failed ? "❌ Échouée" : "⏳ En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function KafkaKpisPage() {
  const [tab, setTab] = useState(0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">KPIs temps réel — Kafka</h1>
        <p className="text-sm text-gray-400 mt-0.5">Calculés en direct depuis les événements Kafka</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === i ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <AperçuTab />}
      {tab === 1 && <OperateursTab />}
      {tab === 2 && <PendingTab />}
    </div>
  );
}
