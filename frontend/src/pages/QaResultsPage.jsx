import { useEffect, useState, useCallback } from "react";
import { fetchQaResults, updateQaResult, deleteQaResult } from "../api/client";

const DECISIONS = ["accepted", "rejected", "rework", "pending"];
const BADGE = {
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  rework: "bg-orange-100 text-orange-700",
  pending: "bg-gray-100 text-gray-500",
  pass: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
};

export default function QaResultsPage() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", operator_id: "", shift_id: "", final_decision: "" });
  const [page, setPage] = useState(0);
  const limit = 50;

  const [detailTarget, setDetailTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchQaResults(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setEditForm({ final_decision: item.final_decision, requires_rework: item.requires_rework ?? false,
      accepted_duration_sec: item.accepted_duration_sec ?? "", rejected_duration_sec: item.rejected_duration_sec ?? "" });
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      await updateQaResult(editTarget._id, {
        ...editForm,
        accepted_duration_sec: editForm.accepted_duration_sec !== "" ? Number(editForm.accepted_duration_sec) : null,
        rejected_duration_sec: editForm.rejected_duration_sec !== "" ? Number(editForm.rejected_duration_sec) : null,
      });
      setEditTarget(null); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteQaResult(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const badge = (val) => val
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[val] ?? "bg-gray-100 text-gray-500"}`}>{val}</span>
    : <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">QA Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>qa_results</code> · {data.total} enregistrements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {[["project_id", "Project ID"], ["operator_id", "Opérateur"], ["shift_id", "Shift"]].map(([k, label]) => (
          <input key={k} value={filters[k]} onChange={(e) => setFilter(k, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={label} />
        ))}
        <select value={filters.final_decision} onChange={(e) => setFilter("final_decision", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Décision (tous)</option>
          {DECISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun résultat QA.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Run ID", "Projet", "Opérateur", "Shift", "QA at", "Décision", "Rework", "Durée acceptée", "Défauts", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[100px] truncate">{item._id}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[100px] truncate">{item.run_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.project_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.operator_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.shift_id}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.qa_at ? new Date(item.qa_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-3 py-2">{badge(item.final_decision)}</td>
                    <td className="px-3 py-2 text-center">{item.requires_rework ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.accepted_duration_sec != null ? `${item.accepted_duration_sec}s` : "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.defects?.total_count ?? "—"}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Détail QA Result</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier QA Result</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Décision finale</label>
                <select value={editForm.final_decision} onChange={(e) => setEditForm((f) => ({ ...f, final_decision: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {DECISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée acceptée (s)</label>
                  <input type="number" value={editForm.accepted_duration_sec} onChange={(e) => setEditForm((f) => ({ ...f, accepted_duration_sec: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée rejetée (s)</label>
                  <input type="number" value={editForm.rejected_duration_sec} onChange={(e) => setEditForm((f) => ({ ...f, rejected_duration_sec: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rework" checked={!!editForm.requires_rework}
                  onChange={(e) => setEditForm((f) => ({ ...f, requires_rework: e.target.checked }))} />
                <label htmlFor="rework" className="text-sm text-gray-700">Rework requis</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Annuler</button>
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
            <p className="text-sm text-gray-600">Supprimer <span className="font-semibold font-mono text-xs">{deleteTarget._id}</span> ?</p>
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
