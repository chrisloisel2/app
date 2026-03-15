import { useEffect, useState, useCallback } from "react";
import { fetchProjects, createProject, updateProject, deleteProject } from "../api/client";

const STATUSES = ["active", "inactive", "closed"];

const EMPTY = {
  _id: "", code: "", name: "", site_id: "", status: "active",
  contract: { planned_hours_total: "", planned_start_at: "", planned_end_at: "", sla_delivery_rate_target: "" },
  rig_capacity: { total_rigs: "", hours_per_rig_per_day: "" },
};

export default function ProjectsPage() {
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
    fetchProjects()
      .then((r) => setItems(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({
      _id: item._id,
      code: item.code ?? "",
      name: item.name ?? "",
      site_id: item.site_id ?? "",
      status: item.status ?? "active",
      contract: { ...EMPTY.contract, ...(item.contract ?? {}) },
      rig_capacity: { ...EMPTY.rig_capacity, ...(item.rig_capacity ?? {}) },
    });
    setFormError(null);
    setModalOpen(true);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setNested = (parent, key, val) =>
    setForm((f) => ({ ...f, [parent]: { ...f[parent], [key]: val } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        contract: {
          planned_hours_total: form.contract.planned_hours_total !== "" ? Number(form.contract.planned_hours_total) : null,
          planned_start_at: form.contract.planned_start_at || null,
          planned_end_at: form.contract.planned_end_at || null,
          sla_delivery_rate_target: form.contract.sla_delivery_rate_target !== "" ? Number(form.contract.sla_delivery_rate_target) : null,
        },
        rig_capacity: {
          total_rigs: form.rig_capacity.total_rigs !== "" ? Number(form.rig_capacity.total_rigs) : null,
          hours_per_rig_per_day: form.rig_capacity.hours_per_rig_per_day !== "" ? Number(form.rig_capacity.hours_per_rig_per_day) : null,
        },
      };
      if (editTarget) {
        await updateProject(editTarget._id, payload);
      } else {
        await createProject(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setDeleteTarget(null);
    }
  };

  const statusBadge = (s) => {
    const colors = { active: "bg-green-100 text-green-700", inactive: "bg-yellow-100 text-yellow-700", closed: "bg-gray-100 text-gray-500" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[s] ?? "bg-gray-100 text-gray-500"}`}>{s}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des projets · collection <code>projects</code></p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Nouveau projet
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun projet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Code", "Nom", "Site", "Statut", "Heures planifiées", "Rigs", "Créé le", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{item._id}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.code}</td>
                  <td className="px-4 py-3 text-gray-700">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.site_id}</td>
                  <td className="px-4 py-3">{statusBadge(item.status)}</td>
                  <td className="px-4 py-3 text-gray-600">{item.contract?.planned_hours_total ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{item.rig_capacity?.total_rigs ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{item.created_at ? new Date(item.created_at).toLocaleDateString("fr-FR") : "—"}</td>
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier le projet" : "Nouveau projet"}</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="prj_001" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                  <input value={form.code} onChange={(e) => set("code", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="PHD-DF-001" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="PHD Data Factory" required />
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Contrat</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heures planifiées totales</label>
                  <input type="number" value={form.contract.planned_hours_total}
                    onChange={(e) => setNested("contract", "planned_hours_total", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SLA taux livraison cible</label>
                  <input type="number" step="0.01" min="0" max="1" value={form.contract.sla_delivery_rate_target}
                    onChange={(e) => setNested("contract", "sla_delivery_rate_target", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Début planifié</label>
                  <input type="datetime-local" value={form.contract.planned_start_at?.slice(0, 16) ?? ""}
                    onChange={(e) => setNested("contract", "planned_start_at", e.target.value ? e.target.value + ":00Z" : "")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin planifiée</label>
                  <input type="datetime-local" value={form.contract.planned_end_at?.slice(0, 16) ?? ""}
                    onChange={(e) => setNested("contract", "planned_end_at", e.target.value ? e.target.value + ":00Z" : "")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Capacité Rigs</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre total de rigs</label>
                  <input type="number" value={form.rig_capacity.total_rigs}
                    onChange={(e) => setNested("rig_capacity", "total_rigs", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heures / rig / jour</label>
                  <input type="number" value={form.rig_capacity.hours_per_rig_per_day}
                    onChange={(e) => setNested("rig_capacity", "hours_per_rig_per_day", e.target.value)}
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

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-sm text-gray-600">Supprimer le projet <span className="font-semibold">{deleteTarget.name}</span> ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Annuler</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
