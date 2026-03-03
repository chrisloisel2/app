import { useParams, useNavigate } from "react-router-dom";
import OverviewSection       from "../components/kpis/OverviewSection";
import DailySection          from "../components/kpis/DailySection";
import OperatorsSection      from "../components/kpis/OperatorsSection";
import RigsSection           from "../components/kpis/RigsSection";
import ShiftsSection         from "../components/kpis/ShiftsSection";
import AnnotationSection     from "../components/kpis/AnnotationSection";
import StaffingSection       from "../components/kpis/StaffingSection";
import IncidentsSection      from "../components/kpis/IncidentsSection";
import DataIntegritySection  from "../components/kpis/DataIntegritySection";
import FinanceSection        from "../components/kpis/FinanceSection";
import ProductionSection     from "../components/kpis/ProductionSection";

const SECTIONS = [
  { key: "overview",        label: "Strategic",       Component: OverviewSection },
  { key: "daily",           label: "Daily",            Component: DailySection },
  { key: "operators",       label: "Operators",        Component: OperatorsSection },
  { key: "rigs",            label: "Rigs",             Component: RigsSection },
  { key: "shifts",          label: "Shifts",           Component: ShiftsSection },
  { key: "annotation",      label: "Annotation",       Component: AnnotationSection },
  { key: "staffing",        label: "Staffing",         Component: StaffingSection },
  { key: "incidents",       label: "Incidents",        Component: IncidentsSection },
  { key: "data-integrity",  label: "Data Integrity",   Component: DataIntegritySection },
  { key: "finance",         label: "Finance",          Component: FinanceSection },
  { key: "production",      label: "Production",       Component: ProductionSection },
];

export default function KPIsPage() {
  const { section = "overview" } = useParams();
  const navigate = useNavigate();
  const active = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const SectionComponent = active.Component;

  return (
    <div className="flex flex-col h-full">
      {/* Horizontal tab strip */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="flex gap-0 overflow-x-auto px-4 scrollbar-none">
          {SECTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => navigate(`/kpis/${key}`)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                key === section
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-6">
        <SectionComponent />
      </div>
    </div>
  );
}
