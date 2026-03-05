import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";

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

const linkBase = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors";
const linkActive = "bg-blue-600 text-white";
const linkInactive = "text-gray-400 hover:bg-gray-800 hover:text-white";

export default function Sidebar() {
  const location = useLocation();
  const kpisOpen = location.pathname.startsWith("/kpis");

  return (
    <aside className="w-56 shrink-0 bg-gray-900 flex flex-col h-screen overflow-y-auto">
      {/* Branding */}
      <div className="px-4 py-5 border-b border-gray-800">
        <p className="text-white font-bold text-base tracking-tight">Physical Data</p>
        <p className="text-gray-500 text-xs mt-0.5">Platform</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        {/* PRODUCTION */}
        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Production</p>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <span>▣</span> Dashboard
          </NavLink>

          {/* KPIs parent link */}
          <NavLink
            to="/kpis/overview"
            className={`${linkBase} ${kpisOpen ? linkActive : linkInactive} mt-0.5`}
          >
            <span>◈</span> KPIs
          </NavLink>

          {/* KPI sub-links */}
          {kpisOpen && (
            <div className="ml-4 mt-0.5 border-l border-gray-700 pl-3 space-y-0.5">
              {KPI_SECTIONS.map(({ key, label }) => (
                <NavLink
                  key={key}
                  to={`/kpis/${key}`}
                  className={({ isActive }) =>
                    `block px-2 py-1.5 rounded text-xs font-medium transition-colors ${
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
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Infrastructure</p>
          <NavLink
            to="/salle-recolte"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
          >
            <span>⬡</span> Salle de récolte
          </NavLink>
          <NavLink
            to="/orchestrateur"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
          >
            <span>◎</span> Orchestrateur
          </NavLink>
        </div>

        {/* DATA EXPLORER */}
        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Data Explorer</p>
          {[
            { to: "/sessions",          label: "Sessions",      icon: "◧" },
            { to: "/sessions-metadata", label: "Metadata",      icon: "◩" },
            { to: "/query",             label: "Query Console", icon: "⟡" },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </div>

        {/* ADMINISTRATION */}
        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Administration</p>
          {[
            { to: "/operateurs",  label: "Opérateurs",  icon: "◉" },
            { to: "/annotateurs", label: "Annotateurs", icon: "◎" },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} mt-0.5`}
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-600">NAS · NFS · CSV</p>
      </div>
    </aside>
  );
}
