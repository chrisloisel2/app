import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function KpiBarChart({ data = [], xKey, bars = [], title, horizontal = false }) {
  const ChartComp = BarChart;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {title && <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <ChartComp
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis dataKey={xKey} type="category" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            </>
          )}
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={b.label || b.key}
              fill={b.color || COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
}
