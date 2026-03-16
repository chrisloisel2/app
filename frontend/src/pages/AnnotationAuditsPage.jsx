import { useEffect, useState, useCallback } from "react";
import { fetchAnnotationAudits, updateAnnotationAudit, deleteAnnotationAudit } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";
import EntitySelect, { operatorItems, projectItems } from "../components/ui/EntitySelect";

const RESULTS = ["pass", "fail", "warning"];
const BADGE = { pass: "bg-green-100 text-green-700", fail: "bg-red-100 text-red-700", warning: "bg-yellow-100 text-yellow-700" };

export default function AnnotationAuditsPage() {
  const { projects, operators } = useReferenceData();
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", annotator_id: "", auditor_id: "", audit_result: "" });
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
    fetchAnnotationAudits(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setEditForm({ audit_result: item.audit_result ?? "", auditor_id: item.auditor_id ?? "",
      annotation_metrics: { ...item.annotation_metrics }, issues: (item.issues ?? []).join(", ") });
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      await updateAnnotationAudit(editTarget._id, {
        audit_result: editForm.audit_result || null,
        auditor_id: editForm.auditor_id || null,
        annotation_metrics: editForm.annotation_metrics,
        issues: editForm.issues.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setEditTarget(null); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteAnnotationAudit(deleteTarget._id); setDeleteTarget(null); load(); }
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
          <h1 className="text-xl font-bold text-gray-900">Annotation Audits</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>annotation_audits</code> · {data.total} enregistrements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {(() => {
          const cls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
          const annotators = operators.filter((o) => ["annotator", "other"].includes(o.role));
          const auditors = operators.filter((o) => ["auditor", "qa", "supervisor", "other"].includes(o.role));
          return (<>
            <select value={filters.project_id} onChange={(e) => setFilter("project_id", e.target.value)} className={cls}>
              <option value="">Tous les projets</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
            </select>
            <select value={filters.annotator_id} onChange={(e) => setFilter("annotator_id", e.target.value)} className={cls}>
              <option value="">Tous les annotateurs</option>
              {annotators.map((o) => <option key={o._id} value={o._id}>{o.full_name}</option>)}
            </select>
            <select value={filters.auditor_id} onChange={(e) => setFilter("auditor_id", e.target.value)} className={cls}>
              <option value="">Tous les auditeurs</option>
              {auditors.map((o) => <option key={o._id} value={o._id}>{o.full_name}</option>)}
            </select>
            <select value={filters.audit_result} onChange={(e) => setFilter("audit_result", e.target.value)} className={cls}>
              <option value="">Résultat (tous)</option>
              {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </>);
        })()}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun audit.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Projet", "Annotateur", "Auditeur", "Heure", "Complétude", "Précision", "IAA", "Résultat", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{projects.find((p) => p._id === item.project_id)?.code ?? item.project_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{operators.find((o) => o._id === item.annotator_id)?.full_name ?? item.annotator_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{operators.find((o) => o._id === item.auditor_id)?.full_name ?? (item.auditor_id ?? "—")}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.audit_hour_bucket ? new Date(item.audit_hour_bucket).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{pct(item.annotation_metrics?.completeness_rate)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{pct(item.annotation_metrics?.accuracy_rate)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{pct(item.annotation_metrics?.inter_annotator_agreement)}</td>
                    <td className="px-3 py-2">{badge(item.audit_result)}</td>
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
              <h2 className="text-lg font-bold text-gray-900">Détail Audit</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier l'audit</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Résultat audit</label>
                <select value={editForm.audit_result} onChange={(e) => setEditForm((f) => ({ ...f, audit_result: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">null</option>
                  {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auditeur</label>
                <EntitySelect
                  value={editForm.auditor_id}
                  onChange={(v) => setEditForm((f) => ({ ...f, auditor_id: v }))}
                  items={operatorItems(operators.filter((o) => ["auditor", "qa", "supervisor", "other"].includes(o.role)))}
                  placeholder="— Aucun auditeur —"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issues (séparées par virgule)</label>
                <input value={editForm.issues} onChange={(e) => setEditForm((f) => ({ ...f, issues: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
