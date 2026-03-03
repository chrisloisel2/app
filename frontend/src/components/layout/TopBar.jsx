import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { checkHealth } from "../../api/client";

const KPI_LABELS = {
  overview:        "Strategic",
  daily:           "Daily",
  operators:       "Operators",
  rigs:            "Rigs",
  shifts:          "Shifts",
  annotation:      "Annotation",
  staffing:        "Staffing",
  incidents:       "Incidents",
  "data-integrity": "Data Integrity",
  finance:         "Finance",
  production:      "Production",
};

function useBreadcrumb() {
  const location = useLocation();
  const { pathname } = location;

  if (pathname === "/dashboard") return "Physical Data Dashboard";
  if (pathname.startsWith("/kpis/")) {
    const section = pathname.split("/kpis/")[1];
    return `KPIs / ${KPI_LABELS[section] || section}`;
  }
  if (pathname.startsWith("/sessions/")) {
    const id = pathname.split("/sessions/")[1];
    return `Sessions / ${id}`;
  }
  if (pathname === "/sessions")          return "Data Explorer / Sessions";
  if (pathname === "/sessions-metadata") return "Data Explorer / Metadata";
  if (pathname === "/query")             return "Data Explorer / Query Console";
  return "Physical Data Platform";
}

export default function TopBar() {
  const [online, setOnline] = useState(null);
  const breadcrumb = useBreadcrumb();

  useEffect(() => {
    const probe = () => {
      checkHealth().then(() => setOnline(true)).catch(() => setOnline(false));
    };
    probe();
    const id = setInterval(probe, 10_000);
    const onVis = () => { if (!document.hidden) probe(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const dotColor = online === null ? "bg-gray-400" : online ? "bg-emerald-500" : "bg-red-500";
  const dotLabel = online === null ? "…" : online ? "API online" : "API offline";

  return (
    <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <span className="text-sm font-semibold text-gray-700">{breadcrumb}</span>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs text-gray-500">{dotLabel}</span>
      </div>
    </header>
  );
}
