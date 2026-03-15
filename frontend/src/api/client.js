import axios from "axios";

const api = axios.create({
  baseURL: "",   // same origin — nginx proxies /api/ to flask
  timeout: 60000,
});

// ── Data Explorer ─────────────────────────────────────────────────────────────
export const fetchSessions          = ()            => api.get("/api/sessions");
export const fetchSession           = (id)          => api.get(`/api/sessions/${id}`);
export const fetchTracker           = (id, params)  => api.get(`/api/sessions/${id}/tracker`, { params });
export const fetchPince             = (id, num, p)  => api.get(`/api/sessions/${id}/pince${num}`, { params: p });
export const fetchSessionsMetadata  = ()            => api.get("/api/metadata/sessions");
export const fetchSessionMetadata   = (id)          => api.get(`/api/metadata/sessions/${id}`);
export const runQuery               = (body)        => api.post("/api/query", body);
export const checkHealth            = ()            => api.get("/api/health");
export const fetchSalleRecolte      = ()            => api.get("/api/salle");
export const fetchOrchestrateur     = ()            => api.get("/api/orchestrateur");

// ── Opérateurs ────────────────────────────────────────────────────────────────
export const fetchOperateurs   = ()        => api.get("/api/operateurs");
export const createOperateur   = (body)    => api.post("/api/operateurs", body);
export const updateOperateur   = (id, body)=> api.put(`/api/operateurs/${id}`, body);
export const deleteOperateur   = (id)      => api.delete(`/api/operateurs/${id}`);

// ── Annotateurs ───────────────────────────────────────────────────────────────
export const fetchAnnotateurs  = ()        => api.get("/api/annotateurs");
export const createAnnotateur  = (body)    => api.post("/api/annotateurs", body);
export const updateAnnotateur  = (id, body)=> api.put(`/api/annotateurs/${id}`, body);
export const deleteAnnotateur  = (id)      => api.delete(`/api/annotateurs/${id}`);

// ── Scénarios ─────────────────────────────────────────────────────────────────
export const fetchScenarios  = ()         => api.get("/api/scenarios");
export const fetchScenario   = (id)       => api.get(`/api/scenarios/${id}`);
export const createScenario  = (body)     => api.post("/api/scenarios", body);
export const updateScenario  = (id, body) => api.put(`/api/scenarios/${id}`, body);
export const deleteScenario  = (id)       => api.delete(`/api/scenarios/${id}`);

// ── SSH Parc ──────────────────────────────────────────────────────────────────
export const fetchSshParc   = ()    => api.get("/api/ssh-parc");
export const deleteSshEntry = (id)  => api.delete(`/api/ssh-parc/${id}`);
export const clearSshParc   = ()    => api.delete("/api/ssh-parc");
// exec utilise fetch natif (SSE streaming) — pas axios

// ── KPIs ──────────────────────────────────────────────────────────────────────
export const fetchKpiOverview      = ()            => api.get("/api/kpis/overview");
export const fetchKpiDaily         = (days = 30)   => api.get("/api/kpis/daily", { params: { days } });
export const fetchKpiOperators     = ()            => api.get("/api/kpis/operators");
export const fetchKpiRigs          = ()            => api.get("/api/kpis/rigs");
export const fetchKpiShifts        = ()            => api.get("/api/kpis/shifts");
export const fetchKpiAnnotation    = ()            => api.get("/api/kpis/annotation");
export const fetchKpiStaffing      = ()            => api.get("/api/kpis/staffing");
export const fetchKpiIncidents     = ()            => api.get("/api/kpis/incidents");
export const fetchKpiDataIntegrity = ()            => api.get("/api/kpis/data-integrity");
export const fetchKpiFinance       = ()            => api.get("/api/kpis/finance");
export const fetchKpiProduction    = ()            => api.get("/api/kpis/production");

// ── Projects ──────────────────────────────────────────────────────────────────
export const fetchProjects   = (params)     => api.get("/api/projects", { params });
export const fetchProject    = (id)         => api.get(`/api/projects/${id}`);
export const createProject   = (body)       => api.post("/api/projects", body);
export const updateProject   = (id, body)   => api.put(`/api/projects/${id}`, body);
export const deleteProject   = (id)         => api.delete(`/api/projects/${id}`);

// ── Rigs ──────────────────────────────────────────────────────────────────────
export const fetchRigs       = (params)     => api.get("/api/rigs", { params });
export const fetchRig        = (id)         => api.get(`/api/rigs/${id}`);
export const createRig       = (body)       => api.post("/api/rigs", body);
export const updateRig       = (id, body)   => api.put(`/api/rigs/${id}`, body);
export const deleteRig       = (id)         => api.delete(`/api/rigs/${id}`);

// ── Shift Calendar ────────────────────────────────────────────────────────────
export const fetchShifts     = (params)     => api.get("/api/shift-calendar", { params });
export const fetchShift      = (id)         => api.get(`/api/shift-calendar/${id}`);
export const createShift     = (body)       => api.post("/api/shift-calendar", body);
export const updateShift     = (id, body)   => api.put(`/api/shift-calendar/${id}`, body);
export const deleteShift     = (id)         => api.delete(`/api/shift-calendar/${id}`);

// ── Project Planning ──────────────────────────────────────────────────────────
export const fetchPlannings  = (params)     => api.get("/api/project-planning", { params });
export const fetchPlanning   = (id)         => api.get(`/api/project-planning/${id}`);
export const createPlanning  = (body)       => api.post("/api/project-planning", body);
export const updatePlanning  = (id, body)   => api.put(`/api/project-planning/${id}`, body);
export const deletePlanning  = (id)         => api.delete(`/api/project-planning/${id}`);

// ── Video Runs ────────────────────────────────────────────────────────────────
export const fetchVideoRuns  = (params)     => api.get("/api/video-runs", { params });
export const fetchVideoRun   = (id)         => api.get(`/api/video-runs/${id}`);
export const createVideoRun  = (body)       => api.post("/api/video-runs", body);
export const updateVideoRun  = (id, body)   => api.put(`/api/video-runs/${id}`, body);
export const deleteVideoRun  = (id)         => api.delete(`/api/video-runs/${id}`);

// ── QA Results ────────────────────────────────────────────────────────────────
export const fetchQaResults  = (params)     => api.get("/api/qa-results", { params });
export const fetchQaResult   = (id)         => api.get(`/api/qa-results/${id}`);
export const createQaResult  = (body)       => api.post("/api/qa-results", body);
export const updateQaResult  = (id, body)   => api.put(`/api/qa-results/${id}`, body);
export const deleteQaResult  = (id)         => api.delete(`/api/qa-results/${id}`);

// ── Annotation Audits ─────────────────────────────────────────────────────────
export const fetchAnnotationAudits = (params)    => api.get("/api/annotation-audits", { params });
export const fetchAnnotationAudit  = (id)        => api.get(`/api/annotation-audits/${id}`);
export const createAnnotationAudit = (body)      => api.post("/api/annotation-audits", body);
export const updateAnnotationAudit = (id, body)  => api.put(`/api/annotation-audits/${id}`, body);
export const deleteAnnotationAudit = (id)        => api.delete(`/api/annotation-audits/${id}`);

// ── Incidents ─────────────────────────────────────────────────────────────────
export const fetchIncidents  = (params)     => api.get("/api/incidents", { params });
export const fetchIncident   = (id)         => api.get(`/api/incidents/${id}`);
export const createIncident  = (body)       => api.post("/api/incidents", body);
export const updateIncident  = (id, body)   => api.put(`/api/incidents/${id}`, body);
export const deleteIncident  = (id)         => api.delete(`/api/incidents/${id}`);

// ── Staff Attendance ──────────────────────────────────────────────────────────
export const fetchAttendances = (params)    => api.get("/api/staff-attendance", { params });
export const fetchAttendance  = (id)        => api.get(`/api/staff-attendance/${id}`);
export const createAttendance = (body)      => api.post("/api/staff-attendance", body);
export const updateAttendance = (id, body)  => api.put(`/api/staff-attendance/${id}`, body);
export const deleteAttendance = (id)        => api.delete(`/api/staff-attendance/${id}`);

// ── Delivery Tracking ─────────────────────────────────────────────────────────
export const fetchDeliveries  = (params)    => api.get("/api/delivery-tracking", { params });
export const fetchDelivery    = (id)        => api.get(`/api/delivery-tracking/${id}`);
export const createDelivery   = (body)      => api.post("/api/delivery-tracking", body);
export const updateDelivery   = (id, body)  => api.put(`/api/delivery-tracking/${id}`, body);
export const deleteDelivery   = (id)        => api.delete(`/api/delivery-tracking/${id}`);

// ── Cost Events ───────────────────────────────────────────────────────────────
export const fetchCostEvents  = (params)    => api.get("/api/cost-events", { params });
export const fetchCostEvent   = (id)        => api.get(`/api/cost-events/${id}`);
export const createCostEvent  = (body)      => api.post("/api/cost-events", body);
export const updateCostEvent  = (id, body)  => api.put(`/api/cost-events/${id}`, body);
export const deleteCostEvent  = (id)        => api.delete(`/api/cost-events/${id}`);

// ── Rig Status Snapshots ──────────────────────────────────────────────────────
export const fetchRigSnapshots = (params)   => api.get("/api/rig-status-snapshots", { params });
export const fetchRigSnapshot  = (id)       => api.get(`/api/rig-status-snapshots/${id}`);
export const createRigSnapshot = (body)     => api.post("/api/rig-status-snapshots", body);
export const updateRigSnapshot = (id, body) => api.put(`/api/rig-status-snapshots/${id}`, body);
export const deleteRigSnapshot = (id)       => api.delete(`/api/rig-status-snapshots/${id}`);

// ── KPI Aggregates ────────────────────────────────────────────────────────────
export const fetchKpiAggregates = (params)   => api.get("/api/kpi-aggregates", { params });
export const fetchKpiAggregate  = (id)       => api.get(`/api/kpi-aggregates/${id}`);
export const createKpiAggregate = (body)     => api.post("/api/kpi-aggregates", body);
export const updateKpiAggregate = (id, body) => api.put(`/api/kpi-aggregates/${id}`, body);
export const deleteKpiAggregate = (id)       => api.delete(`/api/kpi-aggregates/${id}`);
