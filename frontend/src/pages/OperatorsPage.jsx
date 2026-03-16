import { useEffect, useState, useCallback } from "react";
import { fetchOperators, createOperator, updateOperator, deleteOperator } from "../api/client";

const ROLES = ["capture_operator", "annotator", "auditor", "qa", "supervisor", "other"];
const STATUSES = ["active", "inactive", "left"];

const ROLE_BADGE = {
  capture_operator: "bg-blue-100 text-blue-700",
  annotator:        "bg-purple-100 text-purple-700",
  auditor:          "bg-indigo-100 text-indigo-700",
  qa:               "bg-teal-100 text-teal-700",
  supervisor:       "bg-orange-100 text-orange-700",
  other:            "bg-gray-100 text-gray-500",
};
const STATUS_BADGE = {
  active:   "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  left:     "bg-red-100 text-red-600",
};

const EMPTY = {
  _id: "", employee_code: "", full_name: "", role: "capture_operator",
  site_id: "", status: "active",
  skills: "",
  cost_profile: { hourly_cost: "", currency: "EUR" },
};

export default function OperatorsPage() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ role: "", status: "", site_id: "" });
  const [page, setPage] = useState(0);
  const limit = 100;
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
    fetchOperators(params)
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
      _id: item._id,
      employee_code: item.employee_code ?? "",
      full_name: item.full_name ?? "",
      role: item.role ?? "capture_operator",
      site_id: item.site_id ?? "",
      status: item.status ?? "active",
      skills: (item.skills ?? []).join(", "),
      cost_profile: { hourly_cost: item.cost_profile?.hourly_cost ?? "", currency: item.cost_profile?.currency ?? "EUR" },
    });
    setFormError(null); setModalOpen(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        cost_profile: {
          hourly_cost: form.cost_profile.hourly_cost !== "" ? Number(form.cost_profile.hourly_cost) : null,
          currency: form.cost_profile.currency,
        },
      };
      if (editTarget) { await updateOperator(editTarget._id, payload); }
      else { await createOperator(payload); }
      setModalOpen(false); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteOperator(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const badge = (val, map) => val
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[val] ?? "bg-gray-100 text-gray-500"}`}>{val}</span>
    : <span className="text-xs text-gray-400">—</span>;

  const cls = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Opérateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>operators</code> (physical_data) · {data.total} enregistrements</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+ Nouvel opérateur</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filters.role} onChange={(e) => setFilter("role", e.target.value)} className={cls}>
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={cls}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filters.site_id} onChange={(e) => setFilter("site_id", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Site ID" />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucun opérateur.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["ID", "Nom", "Code", "Rôle", "Site", "Statut", "Coût/h", "Skills", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item._id}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.full_name}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.employee_code ?? "—"}</td>
                    <td className="px-3 py-2">{badge(item.role, ROLE_BADGE)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.site_id}</td>
                    <td className="px-3 py-2">{badge(item.status, STATUS_BADGE)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.cost_profile?.hourly_cost != null ? `${item.cost_profile.hourly_cost} ${item.cost_profile.currency ?? ""}` : "—"}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-[150px] truncate">{(item.skills ?? []).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editTarget ? "Modifier l'opérateur" : "Nouvel opérateur"}</h2>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input value={form._id} onChange={(e) => set("_id", e.target.value)} disabled={!!editTarget}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="op_001" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code employé</label>
                  <input value={form.employee_code} onChange={(e) => set("employee_code", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="EMP-001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet <span className="text-red-500">*</span></label>
                <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jean Martin" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rôle <span className="text-red-500">*</span></label>
                  <select value={form.role} onChange={(e) => set("role", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site <span className="text-red-500">*</span></label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (séparés par virgule)</label>
                <input value={form.skills} onChange={(e) => set("skills", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="capture, reset, basic_qa" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coût horaire</label>
                  <input type="number" step="0.01" value={form.cost_profile.hourly_cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost_profile: { ...f.cost_profile, hourly_cost: e.target.value } }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="18.50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                  <input value={form.cost_profile.currency}
                    onChange={(e) => setForm((f) => ({ ...f, cost_profile: { ...f.cost_profile, currency: e.target.value } }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="EUR" />
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
            <p className="text-sm text-gray-600">Supprimer <span className="font-mono text-xs font-semibold">{deleteTarget.full_name}</span> ?</p>
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
