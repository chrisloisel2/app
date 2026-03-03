export default function KpiCard({ label, value, unit = "", trend, color = "default", sub }) {
  const colorMap = {
    default: "text-gray-900",
    green:   "text-emerald-600",
    red:     "text-red-600",
    amber:   "text-amber-600",
    blue:    "text-blue-600",
  };
  const trendEl = trend === "up"
    ? <span className="text-emerald-600 text-xs font-medium">↑</span>
    : trend === "down"
    ? <span className="text-red-500 text-xs font-medium">↓</span>
    : null;

  const display = value === null || value === undefined ? "—" : String(value);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <div className="flex items-end gap-1.5">
        <span className={`text-2xl font-bold leading-none ${colorMap[color]}`}>{display}</span>
        {unit && <span className="text-sm text-gray-400 mb-0.5">{unit}</span>}
        {trendEl}
      </div>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
