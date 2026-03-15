import { useEffect, useState, useCallback } from "react";
import { fetchAttendances, updateAttendance, deleteAttendance } from "../api/client";

export default function StaffAttendancePage() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ project_id: "", shift_id: "", operator_id: "", date: "" });
  const [page, setPage] = useState(0);
  const limit = 100;
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit, skip: page * limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    fetchAttendances(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const openEdit = (item) => {
    setEditTarget(item);
    setEditForm({
      present: item.present ?? false,
      autonomous: item.autonomous ?? null,
      role: item.role ?? "",
      hours: { ...item.hours },
    });
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const hrs = {};
      Object.entries(editForm.hours).forEach(([k, v]) => { hrs[k] = v !== "" ? Number(v) : null; });
      await updateAttendance(editTarget._id, { ...editForm, hours: hrs });
      setEditTarget(null); load();
    } catch (err) { setFormError(err.response?.data?.error ?? err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteAttendance(deleteTarget._id); setDeleteTarget(null); load(); }
    catch (err) { setError(err.response?.data?.error ?? err.message); setDeleteTarget(null); }
  };

  const fmtH = (sec) => sec != null ? `${(sec / 3600).toFixed(1)}h` : "—";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Collection <code>staff_attendance</code> · {data.total} enregistrements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {[["project_id", "Project ID"], ["shift_id", "Shift ID"], ["operator_id", "Opérateur"]].map(([k, label]) => (
          <input key={k} value={filters[k]} onChange={(e) => setFilter(k, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={label} />
        ))}
        <input type="date" value={filters.date} onChange={(e) => setFilter("date", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
          : data.items.length === 0 ? <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Aucune présence.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{["Date", "Opérateur", "Rôle", "Shift", "Planifié", "Présent", "Autonome", "Prod.", "Formation", "Pause", "Downtime", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item._id} className={`hover:bg-gray-50 ${!item.present ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-semibold text-gray-900 text-xs">{item.date}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{item.operator_id}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.role}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{item.shift_id}</td>
                    <td className="px-3 py-2 text-center">{item.scheduled ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-center">{item.present ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-red-400">✗</span>}</td>
                    <td className="px-3 py-2 text-center">{item.autonomous == null ? "—" : item.autonomous ? "✓" : "✗"}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtH(item.hours?.productive_sec)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtH(item.hours?.training_sec)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtH(item.hours?.break_sec)}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{fmtH(item.hours?.downtime_sec)}</td>
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

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Modifier la présence</h2>
            <p className="text-xs font-mono text-gray-500">{editTarget._id}</p>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex gap-6">
                {[["present", "Présent"], ["autonomous", "Autonome"]].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={!!editForm[k]} onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <input value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Heures (secondes)</p>
              <div className="grid grid-cols-3 gap-3">
                {["scheduled_sec", "paid_sec", "productive_sec", "training_sec", "break_sec", "downtime_sec"].map((k) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-600 mb-1">{k.replace("_sec", "")}</label>
                    <input type="number" value={editForm.hours?.[k] ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, hours: { ...f.hours, [k]: e.target.value } }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
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
