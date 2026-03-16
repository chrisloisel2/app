import { useEffect, useState, useCallback } from "react";
import { fetchDeliveries, updateDelivery, deleteDelivery } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";

const UPL_STATUSES = ["pending", "success", "failed"];
const DEL_STATUSES = ["pending", "delivered", "failed"];
const BADGE = {
  pending: "bg-gray-100 text-gray-500",
  success: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function DeliveryTrackingPage() {
  const { projects, shifts } = useReferenceData();
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", shift_id: "", upload_status: "", delivery_status: "" });
  const [page, setPage] = useState(0);
  const limit = 50;
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchDeliveries(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setEditForm({
      upload: { ...item.upload },
      delivery: { ...item.delivery },
    });
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      await updateDelivery(editTarget._id, editForm);
      setEditTarget(null); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteDelivery(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const badge = (val) => val
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[val] ?? "bg-gray-100 text-gray-500"}`}>{val}</span>
    : <span className="text-xs text-gray-400">—</span>;

  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Delivery Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>delivery_tracking</code> · {data.total} enregistrements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {(() => {
          const cls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
          return (<>
            <select value={filters.project_id} onChange={(e) => setFilter("project_id", e.target.value)} className={cls}>
              <option value="">Tous les projets</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
            </select>
            <select value={filters.shift_id} onChange={(e) => setFilter("shift_id", e.target.value)} className={cls}>
              <option value="">Tous les shifts</option>
              {shifts.map((s) => <option key={s._id} value={s._id}>{s.date} · Shift {s.name}</option>)}
            </select>
            <select value={filters.upload_status} onChange={(e) => setFilter("upload_status", e.target.value)} className={cls}>
              <option value="">Upload (tous)</option>
              {UPL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.delivery_status} onChange={(e) => setFilter("delivery_status", e.target.value)} className={cls}>
              <option value="">Livraison (tous)</option>
              {DEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>);
        })()}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucune livraison.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Projet", "Run", "Shift", "Upload", "Livraison", "À temps", "Complétude", "Data Loss", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{projects.find((p) => p._id === item.project_id)?.code ?? item.project_id}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item.run_id}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{(() => { const s = shifts.find((x) => x._id === item.shift_id); return s ? `${s.date} · ${s.name}` : item.shift_id; })()}</td>
                    <td className="px-3 py-2">{badge(item.upload?.status)}</td>
                    <td className="px-3 py-2">{badge(item.delivery?.status)}</td>
                    <td className="px-3 py-2 text-center">{item.delivery?.on_time == null ? "—" : item.delivery.on_time ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-red-500">✗</span>}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{pct(item.dataset_integrity?.dataset_completeness_rate)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{pct(item.dataset_integrity?.data_loss_rate)}</td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setDetailTarget(item)} className="text-gray-500 hover:text-gray-800 text-xs font-medium">Détail</button>
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Modifier</button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Détail Livraison</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier la livraison</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upload</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut upload</label>
                <select value={editForm.upload?.status ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, upload: { ...f.upload, status: e.target.value || null } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">null</option>
                  {UPL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Livraison</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut livraison</label>
                <select value={editForm.delivery?.status ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, delivery: { ...f.delivery, status: e.target.value || null } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">null</option>
                  {DEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!editForm.delivery?.on_time}
                  onChange={(e) => setEditForm((f) => ({ ...f, delivery: { ...f.delivery, on_time: e.target.checked } }))} />
                À temps
              </label>
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
