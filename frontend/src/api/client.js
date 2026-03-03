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
