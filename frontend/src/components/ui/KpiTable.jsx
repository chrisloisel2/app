import Badge from "./Badge";

function formatCell(col, value) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  if (col.type === "bool") return <Badge value={value} variant={value ? "success" : "danger"} />;
  if (col.type === "pct") return `${value}%`;
  if (col.type === "eur") return `€ ${value.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}`;
  if (col.type === "badge") return <Badge value={value} variant={col.variant} />;
  if (typeof value === "boolean") return <Badge value={value} variant={value ? "success" : "danger"} />;
  return String(value);
}

export default function KpiTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Aucune donnée</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-blue-50 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                  {formatCell(c, row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
