import { useEffect, useState, useCallback } from "react";
import { fetchKpiAggregates, deleteKpiAggregate, updateKpiAggregate } from "../api/client";

const GRAINS = ["hour", "day", "shift", "week", "month"];

export default function KpiAggregatesPage() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ grain: "", project_id: "", site_id: "", date: "", week: "", month: "" });
  const [page, setPage] = useState(0);
  const limit = 50;
  const [detailTarget, setDetailTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [kpisJson, setKpisJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchKpiAggregates(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setKpisJson(JSON.stringify(item.kpis ?? {}, null, 2));
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const kpis = JSON.parse(kpisJson);
      await updateKpiAggregate(editTarget._id, { kpis });
      setEditTarget(null); load();
    } catch (err) {
      if (err instanceof SyntaxError) { setFormError("JSON invalide"); }
      else { setFormError(err.response?.data?.error ?? err.message); }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteKpiAggregate(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const grainBadge = (g) => {
    const colors = { hour: "bg-purple-50 text-purple-700", day: "bg-blue-50 text-blue-700", shift: "bg-cyan-50 text-cyan-700", week: "bg-teal-50 text-teal-700", month: "bg-green-50 text-green-700" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[g] ?? "bg-gray-100 text-gray-500"}`}>{g}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">KPI Aggregates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>kpi_aggregates</code> · {data.total} enregistrements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filters.grain} onChange={(e) => setFilter("grain", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Grain (tous)</option>
          {GRAINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {[["project_id", "Project ID"], ["site_id", "Site ID"], ["date", "Date (YYYY-MM-DD)"], ["week", "Semaine (YYYY-Wxx)"], ["month", "Mois (YYYY-MM)"]].map(([k, label]) => (
          <input key={k} value={filters[k]} onChange={(e) => setFilter(k, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={label} />
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun aggregate KPI.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Grain", "Projet", "Site", "Date", "Semaine", "Mois", "KPIs (nb)", "Mis à jour", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[140px] truncate">{item._id}</td>
                    <td className="px-3 py-2">{grainBadge(item.grain)}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.scope?.project_id ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.scope?.site_id ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.period?.date ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.period?.week ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.period?.month ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs font-semibold">{item.kpis ? Object.keys(item.kpis).length : 0}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{item.updated_at ? new Date(item.updated_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setDetailTarget(item)} className="text-gray-500 hover:text-gray-800 text-xs font-medium">Détail</button>
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Modifier KPIs</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-xs font-medium">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Préc.</button>
        <span>Page {page + 1} · {Math.min((page + 1) * limit, data.total)} / {data.total}</span>
        <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv. →</button>
      </div>

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Détail KPI Aggregate</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[65vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Modifier les KPIs</h2>
            <p className="text-xs font-mono text-gray-500">{editTarget._id}</p>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KPIs (JSON)</label>
                <textarea value={kpisJson} onChange={(e) => setKpisJson(e.target.value)} rows={18}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-600 font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Enregistrement…" : "Sauvegarder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-sm text-gray-600">Supprimer <span className="font-mono text-xs font-semibold">{deleteTarget._id}</span> ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 font-medium">Annuler</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
