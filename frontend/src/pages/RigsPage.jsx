import { useEffect, useState, useCallback } from "react";
import { fetchRigs, createRig, updateRig, deleteRig } from "../api/client";

const STATUSES = ["active", "inactive", "maintenance", "retired"];
const EMPTY = { _id: "", code: "", site_id: "", status: "active", project_ids: [], specs: { camera_count: "", max_hours_per_day: "" } };

export default function RigsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchRigs()
      .then((r) => setItems(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormError(null); setModalOpen(true); };
  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      _id: item._id, code: item.code ?? "", site_id: item.site_id ?? "",
      status: item.status ?? "active",
      project_ids: (item.project_ids ?? []).join(", "),
      specs: { camera_count: item.specs?.camera_count ?? "", max_hours_per_day: item.specs?.max_hours_per_day ?? "" },
    });
    setFormError(null); setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSpec = (k, v) => setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = {
        ...form,
        project_ids: typeof form.project_ids === "string"
          ? form.project_ids.split(",").map((s) => s.trim()).filter(Boolean)
          : form.project_ids,
        specs: {
          camera_count: form.specs.camera_count !== "" ? Number(form.specs.camera_count) : null,
          max_hours_per_day: form.specs.max_hours_per_day !== "" ? Number(form.specs.max_hours_per_day) : null,
        },
      };
      if (editTarget) { await updateRig(editTarget._id, payload); } else { await createRig(payload); }
      setModalOpen(false); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteRig(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const statusColors = { active: "bg-green-100 text-green-700", inactive: "bg-yellow-100 text-yellow-700", maintenance: "bg-orange-100 text-orange-700", retired: "bg-gray-100 text-gray-500" };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rigs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des rigs · collection <code>rigs</code></p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">+ Nouveau rig</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun rig.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Code", "Site", "Statut", "Projets", "Caméras", "H/jour max", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.code}</td>
                    <td className="px-4 py-3 text-gray-600">{item.site_id}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[item.status] ?? "bg-gray-100 text-gray-500"}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{(item.project_ids ?? []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{item.specs?.camera_count ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{item.specs?.max_hours_per_day ?? "—"}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier le rig" : "Nouveau rig"}</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="rig_07" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <input value={form.code} onChange={(e) => set("code", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="RIG-07" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site ID <span className="text-red-500">*</span></label>
                  <input value={form.site_id} onChange={(e) => set("site_id", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="site_paris" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project IDs (séparés par virgule)</label>
                <input value={typeof form.project_ids === "string" ? form.project_ids : (form.project_ids ?? []).join(", ")}
                  onChange={(e) => set("project_ids", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="prj_001, prj_002" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nb caméras</label>
                  <input type="number" value={form.specs.camera_count} onChange={(e) => setSpec("camera_count", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max h/jour</label>
                  <input type="number" value={form.specs.max_hours_per_day} onChange={(e) => setSpec("max_hours_per_day", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
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
            <p className="text-sm text-gray-600">Supprimer le rig <span className="font-semibold">{deleteTarget.code}</span> ?</p>
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
