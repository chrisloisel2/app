import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchOperateurs,
  createOperateur,
  updateOperateur,
  deleteOperateur,
} from "../api/client";

const EMPTY_FORM = { numero_poste: "", nom_utilisateur: "", mdp: "" };

export default function OperateursPage() {
  const [operateurs, setOperateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    fetchOperateurs()
      .then((r) => setOperateurs(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  // Chargement initial + re-fetch silencieux piloté par SSE Kafka
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
    const es = new EventSource("/api/salle/stream");
    es.onmessage = () => loadRef.current(true); // re-fetch opérateurs dès que Kafka pousse
    return () => es.close();
  }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (op) => {
    setEditTarget(op);
    setForm({ numero_poste: op.numero_poste, nom_utilisateur: op.nom_utilisateur, mdp: "" });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        await updateOperateur(editTarget._id, form);
      } else {
        await createOperateur(form);
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
      await deleteOperateur(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Opérateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des comptes opérateurs</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nouvel opérateur
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Chargement…
          </div>
        ) : operateurs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Aucun opérateur enregistré.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Poste</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom d'utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">État temps-réel</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operateurs.map((op) => (
                <tr
                  key={op._id}
                  className={`transition-colors ${
                    op.has_alert
                      ? "bg-red-50 hover:bg-red-100"
                      : op.is_recording
                      ? "bg-purple-50 hover:bg-purple-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-gray-700">{op.numero_poste}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${op.has_alert ? "text-red-700" : "text-gray-900"}`}>
                      {op.nom_utilisateur}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {op.has_alert ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                        ⚠ Alerte
                      </span>
                    ) : op.is_recording ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                        ● Enregistrement
                      </span>
                    ) : op.pc_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        Connecté
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(op)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(op)}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">
              {editTarget ? "Modifier l'opérateur" : "Nouvel opérateur"}
            </h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Poste</label>
                <input
                  type="text"
                  value={form.numero_poste}
                  onChange={(e) => setForm((f) => ({ ...f, numero_poste: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: P01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
                <input
                  type="text"
                  value={form.nom_utilisateur}
                  onChange={(e) => setForm((f) => ({ ...f, nom_utilisateur: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: alice"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe{editTarget && <span className="text-gray-400 font-normal"> (laisser vide pour ne pas changer)</span>}
                </label>
                <input
                  type="password"
                  value={form.mdp}
                  onChange={(e) => setForm((f) => ({ ...f, mdp: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required={!editTarget}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Enregistrement…" : editTarget ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-sm text-gray-600">
              Supprimer l'opérateur <span className="font-semibold">{deleteTarget.nom_utilisateur}</span> ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
