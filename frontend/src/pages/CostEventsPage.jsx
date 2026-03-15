import { useEffect, useState, useCallback } from "react";
import { fetchCostEvents, createCostEvent, updateCostEvent, deleteCostEvent } from "../api/client";

const COST_FIELDS = ["labor_cost", "rig_cost", "energy_cost", "storage_cost", "rework_cost", "qa_cost"];
const EMPTY = { _id: "", date: "", project_id: "", site_id: "", shift_id: "", operator_id: "", currency: "EUR", source: "",
  costs: { labor_cost: "", rig_cost: "", energy_cost: "", storage_cost: "", rework_cost: "", qa_cost: "" } };

export default function CostEventsPage() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", site_id: "", date: "" });
  const [page, setPage] = useState(0);
  const limit = 50;
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchCostEvents(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormError(null); setModalOpen(true); };
  const openEdit = (item) => {
    setEditTarget(item);
    setForm({ _id: item._id, date: item.date ?? "", project_id: item.project_id ?? "",
      site_id: item.site_id ?? "", shift_id: item.shift_id ?? "", operator_id: item.operator_id ?? "",
      currency: item.currency ?? "EUR", source: item.source ?? "",
      costs: { ...EMPTY.costs, ...(item.costs ?? {}) } });
    setFormError(null); setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCost = (k, v) => setForm((f) => ({ ...f, costs: { ...f.costs, [k]: v } }));

  const totalCost = (costs) => Object.values(costs ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const costs = {};
      COST_FIELDS.forEach((k) => { costs[k] = form.costs[k] !== "" ? Number(form.costs[k]) : null; });
      const payload = { ...form, costs };
      if (editTarget) { await updateCostEvent(editTarget._id, payload); } else { await createCostEvent(payload); }
      setModalOpen(false); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteCostEvent(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cost Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>cost_events</code> · {data.total} enregistrements</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+ Nouveau coût</button>
      </div>

      <div className="flex flex-wrap gap-3">
        {[["project_id", "Project ID"], ["site_id", "Site ID"]].map(([k, label]) => (
          <input key={k} value={filters[k]} onChange={(e) => setFilter(k, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={label} />
        ))}
        <input type="date" value={filters.date} onChange={(e) => setFilter("date", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun coût.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["Date", "Projet", "Site", "Main-d'œuvre", "Rig", "Énergie", "Stockage", "Rework", "QA", "Total", "Devise", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => {
                  const c = item.costs ?? {};
                  const total = totalCost(c);
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-900 text-xs">{item.date}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{item.project_id}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{item.site_id}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.labor_cost ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.rig_cost ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.energy_cost ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.storage_cost ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.rework_cost ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{c.qa_cost ?? "—"}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900 text-xs">{total.toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{item.currency}</td>
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Modifier</button>
                        <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-xs font-medium">Supprimer</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Préc.</button>
        <span>Page {page + 1} · {Math.min((page + 1) * limit, data.total)} / {data.total}</span>
        <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv. →</button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier" : "Nouveau"} cost event</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project ID <span className="text-red-500">*</span></label>
                  <input value={form.project_id} onChange={(e) => set("project_id", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site ID <span className="text-red-500">*</span></label>
                  <input value={form.site_id} onChange={(e) => set("site_id", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift ID</label>
                  <input value={form.shift_id} onChange={(e) => set("shift_id", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise <span className="text-red-500">*</span></label>
                  <input value={form.currency} onChange={(e) => set("currency", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input value={form.source} onChange={(e) => set("source", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Coûts</p>
              <div className="grid grid-cols-3 gap-3">
                {COST_FIELDS.map((k) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-600 mb-1">{k.replace("_cost", "")}</label>
                    <input type="number" step="0.01" value={form.costs[k]} onChange={(e) => setCost(k, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Enregistrement…" : editTarget ? "Mettre à jour" : "Créer"}
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
