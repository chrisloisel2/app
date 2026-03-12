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

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto h-full">
            <Routes>
              <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"           element={<DashboardPage />} />
              <Route path="/kpis/:section"       element={<KPIsPage />} />
              <Route path="/sessions"            element={<SessionsPage />} />
              <Route path="/sessions-metadata"   element={<SessionsMetadataPage />} />
              <Route path="/sessions/:id"        element={<SessionDetailPage />} />
              <Route path="/query"               element={<QueryPage />} />
              <Route path="/salle-recolte"       element={<SalleRecoltePage />} />
              <Route path="/orchestrateur"       element={<OrchestrateurPage />} />
              <Route path="/operateurs"          element={<OperateursPage />} />
              <Route path="/annotateurs"         element={<AnnotateursPage />} />
              <Route path="/scenarios"           element={<ScenariosPage />} />
              <Route path="/kafka-logs"          element={<KafkaLogsPage />} />
              <Route path="/ssh-parc"            element={<SshParcPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
