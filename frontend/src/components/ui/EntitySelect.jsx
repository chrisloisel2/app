/**
 * Dropdown lié à une entité BDD (projet, opérateur, rig, shift).
 * Props :
 *   value       — valeur courante (id)
 *   onChange    — (value: string) => void
 *   items       — tableau d'objets { _id, label }  (ou calculé via type)
 *   placeholder — texte option vide
 *   required    — bool
 *   disabled    — bool
 *   className   — classes CSS supplémentaires
 */
export default function EntitySelect({
  value,
  onChange,
  items = [],
  placeholder = "— Sélectionner —",
  required = false,
  disabled = false,
  className = "",
}) {
  const base =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-white";

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      required={required}
      disabled={disabled}
      className={`${base} ${className}`}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item._id} value={item._id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

/* ── Helpers pour construire les listes ─────────────────────────────────────── */

export function projectItems(projects) {
  return projects.map((p) => ({ _id: p._id, label: `${p.code} — ${p.name}` }));
}

export function operatorItems(operators) {
  return operators.map((o) => ({
    _id: o._id,
    label: `${o.full_name}${o.employee_code ? ` (${o.employee_code})` : ""} · ${o.role}`,
  }));
}

export function rigItems(rigs) {
  return rigs.map((r) => ({ _id: r._id, label: `${r.code} · ${r.site_id}` }));
}

export function shiftItems(shifts) {
  return shifts.map((s) => ({
    _id: s._id,
    label: `${s.date} · Shift ${s.name} (${s.site_id})`,
  }));
}
