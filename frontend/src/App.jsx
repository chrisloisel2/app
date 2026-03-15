import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import KPIsPage from "./pages/KPIsPage";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import QueryPage from "./pages/QueryPage";
import SessionsMetadataPage from "./pages/SessionsMetadataPage";
import SalleRecoltePage from "./pages/SalleRecoltePage";
import OrchestrateurPage from "./pages/OrchestrateurPage";
import OperateursPage from "./pages/OperateursPage";
import AnnotateursPage from "./pages/AnnotateursPage";
import ScenariosPage from "./pages/ScenariosPage";
import KafkaLogsPage from "./pages/KafkaLogsPage";
import SshParcPage from "./pages/SshParcPage";
import ProjectsPage from "./pages/ProjectsPage";
import RigsPage from "./pages/RigsPage";
import ShiftCalendarPage from "./pages/ShiftCalendarPage";
import ProjectPlanningPage from "./pages/ProjectPlanningPage";
import VideoRunsPage from "./pages/VideoRunsPage";
import QaResultsPage from "./pages/QaResultsPage";
import AnnotationAuditsPage from "./pages/AnnotationAuditsPage";
import IncidentsPage from "./pages/IncidentsPage";
import StaffAttendancePage from "./pages/StaffAttendancePage";
import DeliveryTrackingPage from "./pages/DeliveryTrackingPage";
import CostEventsPage from "./pages/CostEventsPage";
import RigStatusSnapshotsPage from "./pages/RigStatusSnapshotsPage";
import KpiAggregatesPage from "./pages/KpiAggregatesPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto h-full">
            <Routes>
              <Route path="/"                       element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"              element={<DashboardPage />} />
              <Route path="/kpis/:section"          element={<KPIsPage />} />
              <Route path="/sessions"               element={<SessionsPage />} />
              <Route path="/sessions-metadata"      element={<SessionsMetadataPage />} />
              <Route path="/sessions/:id"           element={<SessionDetailPage />} />
              <Route path="/query"                  element={<QueryPage />} />
              <Route path="/salle-recolte"          element={<SalleRecoltePage />} />
              <Route path="/orchestrateur"          element={<OrchestrateurPage />} />
              <Route path="/kafka-logs"             element={<KafkaLogsPage />} />
              <Route path="/ssh-parc"               element={<SshParcPage />} />
              {/* Administration legacy */}
              <Route path="/operateurs"             element={<OperateursPage />} />
              <Route path="/annotateurs"            element={<AnnotateursPage />} />
              <Route path="/scenarios"              element={<ScenariosPage />} />
              {/* Nouvelle base de données physical_data */}
              <Route path="/projects"               element={<ProjectsPage />} />
              <Route path="/rigs"                   element={<RigsPage />} />
              <Route path="/shift-calendar"         element={<ShiftCalendarPage />} />
              <Route path="/project-planning"       element={<ProjectPlanningPage />} />
              <Route path="/video-runs"             element={<VideoRunsPage />} />
              <Route path="/qa-results"             element={<QaResultsPage />} />
              <Route path="/annotation-audits"      element={<AnnotationAuditsPage />} />
              <Route path="/incidents"              element={<IncidentsPage />} />
              <Route path="/staff-attendance"       element={<StaffAttendancePage />} />
              <Route path="/delivery-tracking"      element={<DeliveryTrackingPage />} />
              <Route path="/cost-events"            element={<CostEventsPage />} />
              <Route path="/rig-status-snapshots"   element={<RigStatusSnapshotsPage />} />
              <Route path="/kpi-aggregates"         element={<KpiAggregatesPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
