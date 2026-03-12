import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const KPI_SECTIONS = [
  { key: "overview",        label: "Strategic" },
  { key: "daily",           label: "Daily" },
  { key: "operators",       label: "Operators" },
  { key: "rigs",            label: "Rigs" },
  { key: "shifts",          label: "Shifts" },
  { key: "annotation",      label: "Annotation" },
  { key: "staffing",        label: "Staffing" },
  { key: "incidents",       label: "Incidents" },
  { key: "data-integrity",  label: "Data Integrity" },
  { key: "finance",         label: "Finance" },
  { key: "production",      label: "Production" },
];

export default function Sidebar() {
  const location = useLocation();
  const kpisOpen = location.pathname.startsWith("/kpis");
  const [expanded, setExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  const w = expanded ? "w-56" : "w-14";

  const linkBase = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${expanded ? "" : "justify-center"}`;
  const linkActive = "bg-blue-600 text-white";
  const linkInactive = "text-gray-400 hover:bg-gray-800 hover:text-white";

  return (
    <aside
      className={`${w} shrink-0 bg-gray-900 flex flex-col h-screen overflow-hidden transition-all duration-200`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Branding */}
      <div className={`h-12 flex items-center border-b border-gray-800 shrink-0 ${expanded ? "px-4 gap-2" : "justify-center"}`}>
        <span className="text-blue-400 text-lg font-bold shrink-0">P</span>
        {expanded && <p className="text-white font-bold text-sm tracking-tight whitespace-nowrap overflow-hidden">Physical Data</p>}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
        {/* PRODUCTION */}
        <div>
          {expanded && <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Production</p>}
          <NavLink
            to="/dashboard"
            title="Dashboard"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <span className="shrink-0 text-base">▣</span>
            {expanded && <span className="whitespace-nowrap">Dashboard</span>}
          </NavLink>

          <NavLink
            to="/kpis/overview"
            title="KPIs"
            className={`${linkBase} ${kpisOpen ? linkActive : linkInactive} mt-0.5`}
          >
            <span className="shrink-0 text-base">◈</span>
            {expanded && <span className="whitespace-nowrap">KPIs</span>}
          </NavLink>

          {kpisOpen && expanded && (
            <div className="ml-4 mt-0.5 border-l border-gray-700 pl-3 space-y-0.5">
              {KPI_SECTIONS.map(({ key, label }) => (
                <NavLink
                  key={key}
                  to={`/kpis/${key}`}
                  className={({ isActive }) =>
                    `block px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive ? "text-blue-400" : "text-gray-500 hover:text-gray-200"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* INFRASTRUCTURE */}
        <div>
          {expanded && <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Infrastructure</p>}
          {[
            { to: "/salle-recolte",  label: "Salle de récolte", icon: "⬡" },
            { to: "/orchestrateur",  label: "Orchestrateur",    icon: "◎" },
            { to: "/kafka-logs",     label: "Kafka Logs",       icon: "⬡" },
            { to: "/ssh-parc",       label: "SSH Worm",         icon: "⌨" },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
            >
              <span className="shrink-0 text-base">{icon}</span>
              {expanded && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </div>

        {/* DATA EXPLORER */}
        <div>
          {expanded && <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Data Explorer</p>}
          {[
            { to: "/sessions",          label: "Sessions",      icon: "◧" },
            { to: "/sessions-metadata", label: "Metadata",      icon: "◩" },
            { to: "/query",             label: "Query Console", icon: "⟡" },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
            >
              <span className="shrink-0 text-base">{icon}</span>
              {expanded && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </div>

        {/* ADMINISTRATION */}
        <div>
          {expanded && <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Administration</p>}
          {[
            { to: "/operateurs",  label: "Opérateurs",  icon: "◉" },
            { to: "/annotateurs", label: "Annotateurs", icon: "◎" },
            { to: "/scenarios",   label: "Scénarios",   icon: "◈" },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
            >
              <span className="shrink-0 text-base">{icon}</span>
              {expanded && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className={`py-3 border-t border-gray-800 shrink-0 flex items-center gap-2 ${expanded ? "px-4 justify-between" : "flex-col justify-center"}`}>
        {expanded && <p className="text-xs text-gray-600">NAS · NFS · CSV</p>}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          className="text-gray-500 hover:text-white transition-colors p-1 rounded"
        >
          {isFullscreen ? "⊡" : "⛶"}
        </button>
      </div>
    </aside>
  );
}
