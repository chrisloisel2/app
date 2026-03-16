import { useState, useEffect } from "react";
import { fetchProjects, fetchOperators, fetchRigs, fetchShifts } from "../api/client";

/**
 * Charge les données de référence (projets, opérateurs, rigs, shifts)
 * depuis la BDD pour alimenter les dropdowns.
 */
export function useReferenceData() {
  const [projects, setProjects] = useState([]);
  const [operators, setOperators] = useState([]);
  const [rigs, setRigs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchProjects({ limit: 200 }),
      fetchOperators({ limit: 500 }),
      fetchRigs({ limit: 200 }),
      fetchShifts({ limit: 500 }),
    ])
      .then(([p, o, r, s]) => {
        setProjects(Array.isArray(p.data) ? p.data : (p.data.items ?? []));
        setOperators(Array.isArray(o.data) ? o.data : (o.data.items ?? []));
        setRigs(Array.isArray(r.data) ? r.data : (r.data.items ?? []));
        setShifts(Array.isArray(s.data) ? s.data : (s.data.items ?? []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { projects, operators, rigs, shifts, loading };
}
