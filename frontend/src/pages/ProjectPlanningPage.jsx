import { useEffect, useState, useCallback } from "react";
import { fetchPlannings, createPlanning, updatePlanning, deletePlanning } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";
import EntitySelect, { projectItems } from "../components/ui/EntitySelect";

const EMPTY = { _id: "", project_id: "", date: "", planned_hours: "", planned_operators: "", planned_active_rigs: "", planned_delivery_deadline: "" };

export default function ProjectPlanningPage() {
  const { projects } = useReferenceData();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterProject, setFilterProject] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = filterProject ? { project_id: filterProject } : {};
    fetchPlannings(params)
      .then((r) => setItems(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filterProject]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormError(null); setModalOpen(true); };
  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      _id: item._id, project_id: item.project_id ?? "", date: item.date ?? "",
      planned_hours: item.planned_hours ?? "", planned_operators: item.planned_operators ?? "",
      planned_active_rigs: item.planned_active_rigs ?? "",
      planned_delivery_deadline: item.planned_delivery_deadline ? item.planned_delivery_deadline.slice(0, 16) : "",
    });
    setFormError(null); setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = {
        ...form,
        planned_hours: Number(form.planned_hours),
        planned_operators: form.planned_operators !== "" ? Number(form.planned_operators) : null,
        planned_active_rigs: form.planned_active_rigs !== "" ? Number(form.planned_active_rigs) : null,
        planned_delivery_deadline: form.planned_delivery_deadline ? form.planned_delivery_deadline + ":00Z" : null,
      };
      if (editTarget) { await updatePlanning(editTarget._id, payload); } else { await createPlanning(payload); }
      setModalOpen(false); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deletePlanning(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const projectLabel = (id) => {
    const p = projects.find((x) => x._id === id);
    return p ? `${p.code} — ${p.name}` : id;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Project Planning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>project_planning</code></p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tous les projets</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
          </select>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">+ Nouveau planning</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun planning.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Projet", "Date", "H planifiées", "Opérateurs", "Rigs actifs", "Deadline livraison", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{projectLabel(item.project_id)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.date}</td>
                    <td className="px-4 py-3 text-blue-700 font-semibold">{item.planned_hours}h</td>
                    <td className="px-4 py-3 text-gray-600">{item.planned_operators ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{item.planned_active_rigs ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.planned_delivery_deadline ? new Date(item.planned_delivery_deadline).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 font-medium">Modifier</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700 font-medium">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier le planning" : "Nouveau planning"}</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="plan_prj_001_2026-03-15" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projet <span className="text-red-500">*</span></label>
                  <EntitySelect
                    value={form.project_id}
                    onChange={(v) => set("project_id", v ?? "")}
                    items={projectItems(projects)}
                    placeholder="— Sélectionner un projet —"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heures planifiées <span className="text-red-500">*</span></label>
                  <input type="number" step="0.5" value={form.planned_hours} onChange={(e) => set("planned_hours", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opérateurs planifiés</label>
                  <input type="number" value={form.planned_operators} onChange={(e) => set("planned_operators", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rigs actifs planifiés</label>
                  <input type="number" value={form.planned_active_rigs} onChange={(e) => set("planned_active_rigs", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline de livraison planifiée</label>
                <input type="datetime-local" value={form.planned_delivery_deadline} onChange={(e) => set("planned_delivery_deadline", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
            <p className="text-sm text-gray-600">Supprimer <span className="font-semibold">{deleteTarget._id}</span> ?</p>
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
