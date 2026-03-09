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
