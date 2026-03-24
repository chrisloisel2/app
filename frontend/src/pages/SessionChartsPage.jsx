import { useEffect, useState, useCallback } from "react";
import { fetchSessionCharts } from "../api/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import KpiCard from "../components/ui/KpiCard";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorBanner from "../components/ui/ErrorBanner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f87171", "#a3e635"];

function fmt(v, dec = 1) {
  if (v == null) return "—";
  return typeof v === "number" ? +v.toFixed(dec) : v;
}

function ChartBox({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {title && <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>}
      {children}
    </div>
  );
}

export default function SessionChartsPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    fetchSessionCharts(params)
      .then((r) => { setData(r.data); setError(null); })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const tot    = data?.totals      || {};
  const byDay  = data?.by_day      || [];
  const byHour = data?.by_hour     || [];
  const bySc   = data?.by_scenario || [];
  const bySta  = data?.by_station  || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sessions — Statistiques</h1>
          <p className="text-sm text-gray-400 mt-0.5">Analyse des sessions enregistrées</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700" />
          <span className="text-gray-400 text-sm">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700" />
          <button onClick={load}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            Appliquer
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : error ? <ErrorBanner message={error} /> : (
        <>
          {/* Totaux */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <KpiCard label="Sessions totales"    value={tot.sessions}                color="blue" />
            <KpiCard label="Durée totale"        value={fmt(tot.duration_h, 1)} unit="h"  color="green" />
            <KpiCard label="Volume total"        value={fmt(tot.size_gb, 2)}    unit="GB" />
            <KpiCard label="Durée moyenne"       value={fmt(tot.avg_duration_s, 0)} unit="s" />
            <KpiCard label="Volume moyen"        value={fmt(tot.avg_size_gb, 3)} unit="GB/sess" />
            <KpiCard label="Sessions échouées"   value={tot.failed}              color={tot.failed > 0 ? "red" : "green"} />
            <KpiCard label="Uploads réussis"     value={tot.upload_ok}           color="green" />
            <KpiCard label="Taux succès upload"  value={fmt(tot.success_rate_pct, 1)} unit="%" color={(tot.success_rate_pct ?? 100) >= 95 ? "green" : "red"} />
          </div>

          {/* Par jour */}
          {byDay.length > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartBox title="Sessions par jour">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      <Bar dataKey="sessions" name="Sessions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed"   name="Échouées" fill="#f87171" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>

                <ChartBox title="Heures capturées par jour">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="duration_h" name="Durée (h)" stroke="#10b981" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartBox title="Volume stocké par jour (GB)">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v} GB`]} />
                      <Bar dataKey="size_gb" name="Volume GB" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>

                <ChartBox title="Taux de succès upload % par jour">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v}%`]} />
                      <Line type="monotone" dataKey="success_rate" name="Succès %" stroke="#6366f1" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            </>
          )}

          {/* Par heure */}
          {byHour.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartBox title="Sessions par heure de la journée">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byHour} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="sessions" name="Sessions" radius={[3, 3, 0, 0]}>
                      {byHour.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>

              <ChartBox title="Volume capturé par heure (GB)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byHour} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v} GB`]} />
                    <Bar dataKey="size_gb" name="Volume GB" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          )}

          {/* Par scénario */}
          {bySc.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartBox title="Sessions par scénario">
                <ResponsiveContainer width="100%" height={Math.max(200, bySc.length * 36)}>
                  <BarChart data={bySc} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis dataKey="scenario" type="category" width={120}
                      tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="sessions" name="Sessions" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>

              <ChartBox title="Répartition volume (GB) par scénario">
                <ResponsiveContainer width="100%" height={Math.max(200, bySc.length * 36)}>
                  <BarChart data={bySc} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis dataKey="scenario" type="category" width={120}
                      tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v} GB`]} />
                    <Bar dataKey="size_gb" name="Volume GB" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          )}

          {/* Par station */}
          {bySta.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartBox title="Sessions par station">
                <ResponsiveContainer width="100%" height={Math.max(200, bySta.length * 36)}>
                  <BarChart data={bySta} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis dataKey="station_id" type="category" width={100}
                      tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="sessions" name="Sessions" fill="#10b981" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>

              <ChartBox title="Durée capturée par station (h)">
                <ResponsiveContainer width="100%" height={Math.max(200, bySta.length * 36)}>
                  <BarChart data={bySta} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis dataKey="station_id" type="category" width={100}
                      tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v} h`]} />
                    <Bar dataKey="duration_h" name="Durée (h)" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          )}

          {/* Table détail par jour */}
          {byDay.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Détail par jour</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Sessions</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Durée (h)</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Volume (GB)</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Échouées</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Upload OK</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Succès %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((row) => (
                      <tr key={row.date} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-gray-700">{row.date}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{row.sessions}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(row.duration_h, 2)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(row.size_gb, 3)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${row.failed > 0 ? "text-red-600" : "text-gray-400"}`}>{row.failed}</td>
                        <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{row.upload_ok}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${(row.success_rate ?? 100) >= 95 ? "text-green-600" : "text-red-500"}`}>
                          {row.success_rate != null ? `${row.success_rate}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
