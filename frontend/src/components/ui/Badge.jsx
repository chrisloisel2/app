export default function Badge({ value, variant }) {
  const v = variant || (value === true ? "success" : value === false ? "danger" : "neutral");
  const styles = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    danger:  "bg-red-50 text-red-700 ring-1 ring-red-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    neutral: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  };
  const labels = {
    success: value === true ? "YES" : String(value ?? "OK"),
    danger:  value === false ? "NO" : String(value ?? "FAIL"),
    warning: String(value ?? "WARN"),
    neutral: String(value ?? "—"),
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[v]}`}>
      {labels[v]}
    </span>
  );
}
