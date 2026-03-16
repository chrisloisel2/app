import { useEffect, useState, useCallback } from "react";
import { fetchIncidents, createIncident, updateIncident, deleteIncident } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";
import EntitySelect, { projectItems, operatorItems, rigItems, shiftItems } from "../components/ui/EntitySelect";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "resolved", "ignored"];
const SEV_BADGE = {
  low: "bg-blue-50 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-800 font-bold",
};
const STATUS_BADGE = { open: "bg-red-50 text-red-700", resolved: "bg-green-100 text-green-700", ignored: "bg-gray-100 text-gray-500" };

const EMPTY = { _id: "", project_id: "", site_id: "", rig_id: "", operator_id: "", shift_id: "",
  type: "", severity: "medium", critical_incident: false, started_at: "", resolved_at: "", status: "open",
  root_cause: "", resolution_sec: "" };

export default function IncidentsPage() {
  const { projects, operators, rigs, shifts } = useReferenceData();
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", site_id: "", severity: "", status: "" });
  const [page, setPage] = useState(0);
  const limit = 50;
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchIncidents(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormError(null); setModalOpen(true); };
  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      _id: item._id, project_id: item.project_id ?? "", site_id: item.site_id ?? "",
      rig_id: item.rig_id ?? "", operator_id: item.operator_id ?? "", shift_id: item.shift_id ?? "",
      type: item.type ?? "", severity: item.severity ?? "medium",
      critical_incident: item.critical_incident ?? false,
      started_at: item.started_at ? item.started_at.slice(0, 16) : "",
      resolved_at: item.resolved_at ? item.resolved_at.slice(0, 16) : "",
      status: item.status ?? "open", root_cause: item.root_cause ?? "",
      resolution_sec: item.resolution_sec ?? "",
    });
    setFormError(null); setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = {
        ...form,
        started_at: form.started_at ? form.started_at + ":00Z" : undefined,
        resolved_at: form.resolved_at ? form.resolved_at + ":00Z" : null,
        resolution_sec: form.resolution_sec !== "" ? Number(form.resolution_sec) : null,
      };
      if (editTarget) { await updateIncident(editTarget._id, payload); } else { await createIncident(payload); }
      setModalOpen(false); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteIncident(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const badge = (val, map) => val
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[val] ?? "bg-gray-100 text-gray-500"}`}>{val}</span>
    : <span className="text-xs text-gray-400">—</span>;

  const opLabel = (id) => { const o = operators.find((x) => x._id === id); return o ? o.full_name : id; };
  const projLabel = (id) => { const p = projects.find((x) => x._id === id); return p ? p.code : id; };
  const rigLabel = (id) => { const r = rigs.find((x) => x._id === id); return r ? r.code : id; };

  const selectCls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>incidents</code> · {data.total} enregistrements</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+ Nouvel incident</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filters.project_id} onChange={(e) => setFilter("project_id", e.target.value)} className={selectCls}>
          <option value="">Tous les projets</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
        </select>
        <input value={filters.site_id} onChange={(e) => setFilter("site_id", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Site ID" />
        <select value={filters.severity} onChange={(e) => setFilter("severity", e.target.value)} className={selectCls}>
          <option value="">Sévérité (tous)</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={selectCls}>
          <option value="">Statut (tous)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun incident.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Projet", "Site", "Type", "Sévérité", "Critique", "Démarré", "Résolu", "Statut", "Temps résolution", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className={`hover:bg-gray-50 ${item.critical_incident ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{projLabel(item.project_id)}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.site_id}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.type}</td>
                    <td className="px-3 py-2">{badge(item.severity, SEV_BADGE)}</td>
                    <td className="px-3 py-2 text-center">{item.critical_incident ? "🔴" : "—"}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.started_at ? new Date(item.started_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.resolved_at ? new Date(item.resolved_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-3 py-2">{badge(item.status, STATUS_BADGE)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.resolution_sec != null ? `${Math.round(item.resolution_sec / 60)}min` : "—"}</td>
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
              <h2 className="text-lg font-bold text-gray-900">Détail Incident</h2>
              <button onClick={() => setDetailTarget(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(detailTarget, null, 2)}</pre>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier l'incident" : "Nouvel incident"}</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="inc_20260315_001" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <input value={form.type} onChange={(e) => set("type", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="camera_sync_failure" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projet <span className="text-red-500">*</span></label>
                  <EntitySelect value={form.project_id} onChange={(v) => set("project_id", v ?? "")}
                    items={projectItems(projects)} placeholder="— Sélectionner —" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site ID <span className="text-red-500">*</span></label>
                  <input value={form.site_id} onChange={(e) => set("site_id", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rig</label>
                  <EntitySelect value={form.rig_id} onChange={(v) => set("rig_id", v ?? "")}
                    items={rigItems(rigs)} placeholder="— Aucun rig —" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur</label>
                  <EntitySelect value={form.operator_id} onChange={(v) => set("operator_id", v ?? "")}
                    items={operatorItems(operators)} placeholder="— Aucun opérateur —" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                <EntitySelect value={form.shift_id} onChange={(v) => set("shift_id", v ?? "")}
                  items={shiftItems(shifts)} placeholder="— Aucun shift —" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
                  <select value={form.severity} onChange={(e) => set("severity", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.critical_incident} onChange={(e) => set("critical_incident", e.target.checked)} />
                    Critique
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Démarré le <span className="text-red-500">*</span></label>
                  <input type="datetime-local" value={form.started_at} onChange={(e) => set("started_at", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Résolu le</label>
                  <input type="datetime-local" value={form.resolved_at} onChange={(e) => set("resolved_at", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cause racine</label>
                  <input value={form.root_cause} onChange={(e) => set("root_cause", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temps résolution (s)</label>
                  <input type="number" value={form.resolution_sec} onChange={(e) => set("resolution_sec", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
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
