import { useEffect, useState, useCallback } from "react";
import { fetchPlannings, fetchShifts, fetchAttendances } from "../api/client";
import { useReferenceData } from "../hooks/useReferenceData";

const SHIFT_COLORS = {
  A: "bg-blue-100 border-blue-300 text-blue-800",
  B: "bg-purple-100 border-purple-300 text-purple-800",
  C: "bg-green-100 border-green-300 text-green-800",
  D: "bg-orange-100 border-orange-300 text-orange-800",
};

function getWeekDates(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().slice(0, 10);
  });
}

function fmt(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default function PlanningPage() {
  const { projects } = useReferenceData();
  const [refDate, setRefDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedProject, setSelectedProject] = useState("");
  const [plannings, setPlannings] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const weekDates = getWeekDates(refDate);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const dateStart = weekDates[0];
    const dateEnd = weekDates[6];

    const planParams = { limit: 200 };
    if (selectedProject) planParams.project_id = selectedProject;

    Promise.all([
      fetchPlannings(planParams),
      fetchShifts({ limit: 500 }),
      fetchAttendances({ limit: 1000 }),
    ])
      .then(([p, s, a]) => {
        const plans = Array.isArray(p.data) ? p.data : (p.data.items ?? []);
        const allShifts = Array.isArray(s.data) ? s.data : (s.data.items ?? []);
        const allAttendances = Array.isArray(a.data) ? a.data : (a.data.items ?? []);

        // Filtre sur la semaine visible
        setPlannings(plans.filter((pl) => pl.date >= dateStart && pl.date <= dateEnd));
        setShifts(allShifts.filter((sh) => sh.date >= dateStart && sh.date <= dateEnd));
        setAttendances(allAttendances.filter((at) => at.date >= dateStart && at.date <= dateEnd));
      })
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [refDate, selectedProject]);

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 7);
    setRefDate(d.toISOString().slice(0, 10));
  };
  const nextWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 7);
    setRefDate(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);

  // Groupes : pour chaque date → liste des shifts → liste des présences
  const shiftsForDate = (date) => shifts.filter((s) => s.date === date);
  const planForDate = (date) => plannings.filter((p) => p.date === date);
  const attendanceForShift = (shiftId) => attendances.filter((a) => a.shift_id === shiftId);
  const presentCount = (shiftId) => attendances.filter((a) => a.shift_id === shiftId && a.present).length;
  const scheduledCount = (shiftId) => attendances.filter((a) => a.shift_id === shiftId && a.scheduled).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue hebdomadaire · shifts, présences, heures planifiées</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tous les projets</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">← Préc.</button>
            <button onClick={() => setRefDate(today)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-blue-600 font-medium">Aujourd'hui</button>
            <button onClick={nextWeek} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Suiv. →</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {weekDates.map((date) => {
            const isToday = date === today;
            const dayShifts = shiftsForDate(date);
            const dayPlans = planForDate(date);

            return (
              <div key={date} className={`rounded-xl border ${isToday ? "border-blue-400 shadow-md shadow-blue-100" : "border-gray-200"} bg-white overflow-hidden`}>
                {/* Day header */}
                <div className={`px-3 py-2 border-b ${isToday ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-blue-700" : "text-gray-600"}`}>
                    {fmt(date)}
                  </p>
                  {isToday && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Aujourd'hui</span>}
                </div>

                <div className="p-2 space-y-2">
                  {/* Planning hours */}
                  {dayPlans.length > 0 && (
                    <div className="space-y-1">
                      {dayPlans.map((pl) => {
                        const proj = projects.find((p) => p._id === pl.project_id);
                        return (
                          <div key={pl._id} className="bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 text-xs">
                            <p className="font-semibold text-indigo-700 truncate">{proj ? proj.code : pl.project_id}</p>
                            <div className="flex justify-between mt-0.5 text-indigo-600">
                              <span>{pl.planned_hours}h planifiées</span>
                              {pl.planned_operators && <span>{pl.planned_operators} op.</span>}
                            </div>
                            {pl.planned_active_rigs && (
                              <p className="text-indigo-500 mt-0.5">{pl.planned_active_rigs} rigs</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Shifts */}
                  {dayShifts.length === 0 && dayPlans.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">—</p>
                  )}

                  {dayShifts.map((shift) => {
                    const present = presentCount(shift._id);
                    const scheduled = scheduledCount(shift._id);
                    const colorCls = SHIFT_COLORS[shift.name] ?? "bg-gray-100 border-gray-300 text-gray-700";
                    const attendanceRate = scheduled > 0 ? present / scheduled : null;

                    return (
                      <div key={shift._id} className={`rounded-lg border px-2 py-1.5 text-xs ${colorCls}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Shift {shift.name}</span>
                          <span className="text-xs opacity-70">
                            {new Date(shift.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}–
                            {new Date(shift.end_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {scheduled > 0 && (
                          <div className="mt-1">
                            <div className="flex justify-between mb-0.5">
                              <span>{present}/{scheduled} présents</span>
                              {attendanceRate != null && (
                                <span className={attendanceRate >= 0.9 ? "text-green-700 font-semibold" : attendanceRate >= 0.7 ? "text-orange-600" : "text-red-600 font-bold"}>
                                  {(attendanceRate * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-white/50 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${attendanceRate >= 0.9 ? "bg-green-500" : attendanceRate >= 0.7 ? "bg-orange-400" : "bg-red-500"}`}
                                style={{ width: `${Math.min((attendanceRate ?? 0) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {scheduled === 0 && (
                          <p className="opacity-60 mt-0.5">Aucune présence enregistrée</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span className="font-semibold text-gray-600">Légende :</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-300 inline-block" /> Planning</span>
        {Object.entries(SHIFT_COLORS).map(([name, cls]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border inline-block ${cls}`} /> Shift {name}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Taux présence ≥90%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> ≥70%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> &lt;70%</span>
      </div>
    </div>
  );
}
