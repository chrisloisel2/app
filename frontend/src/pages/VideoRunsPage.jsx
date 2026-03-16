import { useEffect, useState, useCallback } from "react";
import { fetchVideoRuns, updateVideoRun, deleteVideoRun } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";
import EntitySelect, { projectItems, operatorItems, rigItems, shiftItems } from "../components/ui/EntitySelect";

const QA_STATUSES = ["pending", "accepted", "rejected", "rework"];
const BADGE_COLORS = {
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  rework: "bg-orange-100 text-orange-700",
  pending: "bg-gray-100 text-gray-500",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  success: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
};

export default function VideoRunsPage() {
  const { projects, operators, rigs, shifts } = useReferenceData();
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", operator_id: "", rig_id: "", shift_id: "", qa_status: "" });
  const [page, setPage] = useState(0);
  const limit = 50;

  const [detailTarget, setDetailTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [pipelineForm, setPipelineForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchVideoRuns(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setPipelineForm({ ...item.pipeline_status });
    setFormError(null);
  };

  const handlePipelineSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      await updateVideoRun(editTarget._id, { pipeline_status: pipelineForm });
      setEditTarget(null); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteVideoRun(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const badge = (val) => val
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_COLORS[val] ?? "bg-gray-100 text-gray-500"}`}>{val}</span>
    : <span className="text-xs text-gray-400">—</span>;

  const opLabel = (id) => { const o = operators.find((x) => x._id === id); return o ? o.full_name : id; };
  const projLabel = (id) => { const p = projects.find((x) => x._id === id); return p ? p.code : id; };
  const rigLabel = (id) => { const r = rigs.find((x) => x._id === id); return r ? r.code : id; };
  const shiftLabel = (id) => { const s = shifts.find((x) => x._id === id); return s ? `${s.date} · ${s.name}` : id; };

  const selectCls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Video Runs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>video_runs</code> · {data.total} enregistrements</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filters.project_id} onChange={(e) => setFilter("project_id", e.target.value)} className={selectCls}>
          <option value="">Tous les projets</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
        </select>
        <select value={filters.operator_id} onChange={(e) => setFilter("operator_id", e.target.value)} className={selectCls}>
          <option value="">Tous les opérateurs</option>
          {operators.map((o) => <option key={o._id} value={o._id}>{o.full_name}{o.employee_code ? ` (${o.employee_code})` : ""}</option>)}
        </select>
        <select value={filters.rig_id} onChange={(e) => setFilter("rig_id", e.target.value)} className={selectCls}>
          <option value="">Tous les rigs</option>
          {rigs.map((r) => <option key={r._id} value={r._id}>{r.code}</option>)}
        </select>
        <select value={filters.shift_id} onChange={(e) => setFilter("shift_id", e.target.value)} className={selectCls}>
          <option value="">Tous les shifts</option>
          {shifts.map((s) => <option key={s._id} value={s._id}>{s.date} · Shift {s.name}</option>)}
        </select>
        <select value={filters.qa_status} onChange={(e) => setFilter("qa_status", e.target.value)} className={selectCls}>
          <option value="">QA status (tous)</option>
          {QA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun run.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Projet", "Opérateur", "Rig", "Shift", "Durée brute", "QA", "Annotation", "Upload", "Livraison", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs max-w-[120px] truncate">{item._id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{projLabel(item.project_id)}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{opLabel(item.operator_id)}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{rigLabel(item.rig_id)}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{shiftLabel(item.shift_id)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.video?.raw_duration_sec ? `${item.video.raw_duration_sec}s` : "—"}</td>
                    <td className="px-3 py-2">{badge(item.pipeline_status?.qa_status)}</td>
                    <td className="px-3 py-2">{badge(item.pipeline_status?.annotation_status)}</td>
                    <td className="px-3 py-2">{badge(item.pipeline_status?.upload_status)}</td>
                    <td className="px-3 py-2">{badge(item.pipeline_status?.delivery_status)}</td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setDetailTarget(item)} className="text-gray-500 hover:text-gray-800 text-xs font-medium">Détail</button>
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Pipeline</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 text-xs font-medium">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Préc.</button>
        <span>Page {page + 1} · {Math.min((page + 1) * limit, data.total)} / {data.total}</span>
        <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv. →</button>
      </div>

      {/* Detail modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Détail Run</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Pipeline edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier le pipeline</h2>
            <p className="text-xs text-gray-500 font-mono">{editTarget._id}</p>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handlePipelineSave} className="space-y-3">
              {[["qa_status", ["pending", "accepted", "rejected", "rework"]],
                ["annotation_status", ["pending", "in_progress", "completed", "failed"]],
                ["upload_status", ["pending", "success", "failed"]],
                ["delivery_status", ["pending", "delivered", "failed"]]].map(([field, opts]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field}</label>
                  <select value={pipelineForm[field] ?? ""} onChange={(e) => setPipelineForm((f) => ({ ...f, [field]: e.target.value || null }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">null</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ingested" checked={!!pipelineForm.ingested}
                  onChange={(e) => setPipelineForm((f) => ({ ...f, ingested: e.target.checked }))} />
                <label htmlFor="ingested" className="text-sm text-gray-700">Ingéré</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rework_required" checked={!!pipelineForm.rework_required}
                  onChange={(e) => setPipelineForm((f) => ({ ...f, rework_required: e.target.checked }))} />
                <label htmlFor="rework_required" className="text-sm text-gray-700">Rework requis</label>
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
            <p className="text-sm text-gray-600">Supprimer le run <span className="font-semibold font-mono text-xs">{deleteTarget._id}</span> ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Annuler</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
