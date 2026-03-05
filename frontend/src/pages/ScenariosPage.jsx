import { useEffect, useState, useCallback } from "react";
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  publishScenario,
  fetchRabbitMQStatus,
} from "../api/client";

const EMPTY_FORM = { nom: "", description: "", duree_min: "", actif: true };

// ── Small status badge ────────────────────────────────────────────────────────
function Badge({ actif }) {
  return actif ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Inactif
    </span>
  );
}

// ── RabbitMQ status pill ──────────────────────────────────────────────────────
function RabbitMQStatusBadge({ status }) {
  if (!status) return null;
  const ok = status.connected;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
        ok
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-600"
      }`}
      title={status.error || `Queue: ${status.queue}`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      RabbitMQ {ok ? "connecté" : "déconnecté"}
      {ok && (
        <span className="ml-1 text-green-600 font-semibold">{status.messages} msg</span>
      )}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ScenariosPage() {
  const [scenarios, setScenarios]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [rmqStatus, setRmqStatus]   = useState(null);
  const [rmqLoading, setRmqLoading] = useState(false);

  // modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState(null);
  const [saving, setSaving]         = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // publish feedback
  const [publishFeedback, setPublishFeedback] = useState(null); // { id, ok, msg }

  // ── Loaders ───────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchScenarios()
      .then((r) => setScenarios(r.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadRmqStatus = useCallback(() => {
    setRmqLoading(true);
    fetchRabbitMQStatus()
      .then((r) => setRmqStatus(r.data))
      .catch(() => setRmqStatus({ connected: false, error: "Impossible de joindre RabbitMQ" }))
      .finally(() => setRmqLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadRmqStatus();
  }, [load, loadRmqStatus]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      nom:         s.nom,
      description: s.description || "",
      duree_min:   s.duree_min ?? "",
      actif:       s.actif,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      ...form,
      duree_min: form.duree_min === "" ? 0 : Number(form.duree_min),
    };
    try {
      if (editTarget) {
        await updateScenario(editTarget._id, payload);
      } else {
        await createScenario(payload);
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
      await deleteScenario(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setDeleteTarget(null);
    }
  };

  const handlePublish = async (s) => {
    setPublishFeedback(null);
    try {
      await publishScenario(s._id);
      setPublishFeedback({ id: s._id, ok: true, msg: `"${s.nom}" envoyé dans la queue RabbitMQ` });
      loadRmqStatus();
    } catch (err) {
      setPublishFeedback({ id: s._id, ok: false, msg: err.response?.data?.error ?? err.message });
    }
    setTimeout(() => setPublishFeedback(null), 4000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scénarios d'enregistrement</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion et publication via RabbitMQ</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={loadRmqStatus}
            disabled={rmqLoading}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {rmqLoading ? "…" : "↻ RabbitMQ"}
          </button>
          <RabbitMQStatusBadge status={rmqStatus} />
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Nouveau scénario
          </button>
        </div>
      </div>

      {/* RabbitMQ info card */}
      {rmqStatus && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
          rmqStatus.connected
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <span className="text-lg mt-0.5">{rmqStatus.connected ? "🐇" : "⚠️"}</span>
          <div>
            {rmqStatus.connected ? (
              <>
                <p className="font-medium">RabbitMQ opérationnel</p>
                <p className="text-xs mt-0.5">
                  Queue <span className="font-mono font-semibold">{rmqStatus.queue}</span> —{" "}
                  <span className="font-semibold">{rmqStatus.messages}</span> message(s) en attente
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">RabbitMQ inaccessible</p>
                <p className="text-xs mt-0.5">{rmqStatus.error}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Publish feedback toast */}
      {publishFeedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium border ${
            publishFeedback.ok
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {publishFeedback.ok ? "✓ " : "✗ "}
          {publishFeedback.msg}
        </div>
      )}

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
        ) : scenarios.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Aucun scénario enregistré.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Durée (min)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Créé le</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scenarios.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.nom}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
                    {s.description || <span className="italic text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono hidden sm:table-cell">
                    {s.duree_min ? `${s.duree_min} min` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge actif={s.actif} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {s.created_at ? new Date(s.created_at).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePublish(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 text-xs font-medium rounded-lg transition-colors"
                        title="Publier dans la queue RabbitMQ"
                      >
                        ▶ Publier
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stats bar */}
      {!loading && scenarios.length > 0 && (
        <div className="flex gap-6 text-xs text-gray-500">
          <span>{scenarios.length} scénario(s) au total</span>
          <span>{scenarios.filter((s) => s.actif).length} actif(s)</span>
          <span>{scenarios.filter((s) => !s.actif).length} inactif(s)</span>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">
              {editTarget ? "Modifier le scénario" : "Nouveau scénario"}
            </h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du scénario</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: scénario_A"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Description optionnelle du scénario…"
                />
              </div>

              {/* Durée + Actif row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée estimée (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.duree_min}
                    onChange={(e) => setForm((f) => ({ ...f, duree_min: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setForm((f) => ({ ...f, actif: !f.actif }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        form.actif ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          form.actif ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Actif</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
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

      {/* ── Delete Confirm Modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Confirmer la suppression</h2>
            <p className="text-sm text-gray-600">
              Supprimer le scénario <span className="font-semibold">"{deleteTarget.nom}"</span> ? Cette action est irréversible.
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
