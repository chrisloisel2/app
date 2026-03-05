import { useEffect, useState, useCallback } from "react";
import { fetchSalleRecolte } from "../api/client";

// ── Couleurs de statut ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  online:      { ring: "#22d3ee", glow: "rgba(34,211,238,0.35)", label: "#22d3ee" },
  active:      { ring: "#22c55e", glow: "rgba(34,197,94,0.35)",  label: "#22c55e" },
  sending:     { ring: "#f59e0b", glow: "rgba(245,158,11,0.35)", label: "#f59e0b" },
  queued:      { ring: "#6366f1", glow: "rgba(99,102,241,0.35)", label: "#6366f1" },
  offline:     { ring: "#374151", glow: "rgba(55,65,81,0.15)",   label: "#6b7280" },
  error:       { ring: "#ef4444", glow: "rgba(239,68,68,0.35)",  label: "#ef4444" },
  degraded:    { ring: "#f97316", glow: "rgba(249,115,22,0.35)", label: "#f97316" },
};

function pcStatus(pc) {
  if (pc._offline) return "offline";
  const send = pc.last_send?.status;
  if (send === "in_progress") return "sending";
  const q = pc.sqlite_queue?.pending_sessions ?? 0;
  if (q > 0) return "queued";
  return "active";
}

function nasStatus(nas) {
  if (!nas) return "offline";
  return nas.status === "online" ? "online" : nas.status === "degraded" ? "degraded" : "error";
}

function spoolStatus(spool) {
  if (!spool) return "offline";
  if (spool.current_transfer) return "sending";
  if ((spool.inbound_queue?.length ?? 0) > 0) return "queued";
  return "active";
}

// ── PC Box ────────────────────────────────────────────────────────────────────
function PcBox({ pc, selected, onClick }) {
  const st = pcStatus(pc);
  const c = STATUS_COLOR[st];
  const queue = pc.sqlite_queue?.pending_sessions ?? null;
  const isSending = pc.last_send?.status === "in_progress";

  return (
    <div
      onClick={onClick}
      title={`${pc.hostname || `pc-${String(pc.pc_id).padStart(2,"0")}`}`}
      style={{
        border: `1.5px solid ${selected ? "#93c5fd" : c.ring}`,
        boxShadow: selected
          ? `0 0 0 2px #3b82f6, 0 0 10px ${c.glow}`
          : `0 0 6px ${c.glow}`,
        background: "rgba(15,23,42,0.9)",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        borderRadius: 4,
        padding: "4px 3px 3px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* PC ID */}
      <span style={{ color: c.label, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
        {String(pc.pc_id).padStart(2, "0")}
      </span>

      {/* Monitor icon */}
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="16" height="10" rx="1.5" stroke={c.ring} strokeWidth="1.2" fill="rgba(15,23,42,0.6)" />
        <rect x="7" y="11" width="4" height="1.5" rx="0.5" fill={c.ring} opacity="0.6" />
        <rect x="5" y="12.5" width="8" height="0.8" rx="0.4" fill={c.ring} opacity="0.4" />
        {isSending && (
          <rect x="3" y="3" width="12" height="6" rx="0.5" fill={c.ring} opacity="0.18" />
        )}
      </svg>

      {/* Queue badge */}
      {queue !== null && queue > 0 && (
        <span style={{
          background: "#6366f1",
          color: "#fff",
          fontSize: 7,
          fontWeight: 700,
          borderRadius: 3,
          padding: "0 3px",
          lineHeight: "11px",
        }}>
          {queue}
        </span>
      )}

      {/* Pulse dot top-right */}
      <span style={{
        position: "absolute",
        top: 3,
        right: 3,
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: c.ring,
        boxShadow: `0 0 4px ${c.glow}`,
      }} />
    </div>
  );
}

// ── Panel de détail PC ────────────────────────────────────────────────────────
function PcDetailPanel({ pc, onClose }) {
  if (!pc) return null;
  const st = pcStatus(pc);
  const c = STATUS_COLOR[st];
  const q = pc.sqlite_queue;
  const ls = pc.last_send;

  return (
    <div style={{
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 300,
      background: "rgba(2,8,23,0.97)",
      border: "1px solid rgba(99,102,241,0.4)",
      borderRadius: 8,
      padding: 16,
      overflowY: "auto",
      zIndex: 10,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: c.label, fontWeight: 700, fontSize: 14 }}>
          {pc.hostname || `pc-${String(pc.pc_id).padStart(2, "0")}`}
        </span>
        <button
          onClick={onClose}
          style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
        >✕</button>
      </div>

      <Row label="ID" value={`PC-${String(pc.pc_id).padStart(2, "0")}`} />
      <Row label="Statut" value={st.toUpperCase()} color={c.label} />
      <Row label="Vu le" value={pc.timestamp ? new Date(pc.timestamp).toLocaleString("fr-FR") : "—"} />

      {q ? (
        <>
          <Divider label="File SQLite" />
          <Row label="Sessions en attente" value={q.pending_sessions ?? "—"} />
          <Row label="Enregistrements" value={q.total_records?.toLocaleString() ?? "—"} />
          <Row label="Plus ancienne" value={q.oldest_pending_iso ? new Date(q.oldest_pending_iso).toLocaleString("fr-FR") : "—"} />
          {q.sessions?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>Sessions</p>
              {q.sessions.slice(0, 5).map((s, i) => (
                <div key={i} style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 4,
                  padding: "4px 8px",
                  marginBottom: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                }}>
                  <span style={{ color: "#e2e8f0" }}>{s.session_id}</span>
                  <span style={{ color: "#6b7280" }}>{s.records?.toLocaleString()} rec · {s.status}</span>
                </div>
              ))}
              {q.sessions.length > 5 && (
                <p style={{ color: "#6b7280", fontSize: 10, textAlign: "center" }}>+{q.sessions.length - 5} de plus…</p>
              )}
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "#4b5563", fontSize: 11, marginTop: 12 }}>Aucune donnée de file SQLite</p>
      )}

      {ls && (
        <>
          <Divider label="Dernier envoi au Spool" />
          <Row label="Session" value={ls.session_id ?? "—"} />
          <Row label="Statut" value={ls.status ?? "—"} color={ls.status === "success" ? "#22c55e" : ls.status === "failed" ? "#ef4444" : "#f59e0b"} />
          <Row label="Envoyé le" value={ls.sent_at ? new Date(ls.sent_at).toLocaleString("fr-FR") : "—"} />
          <Row label="Enregistrements" value={ls.records_sent?.toLocaleString() ?? "—"} />
        </>
      )}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: color ?? "#e2e8f0", fontWeight: color ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ borderTop: "1px solid rgba(99,102,241,0.2)", margin: "10px 0 8px", paddingTop: 6 }}>
      <span style={{ color: "#6366f1", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

// ── Carte Spool ───────────────────────────────────────────────────────────────
function SpoolCard({ spool }) {
  const st = spoolStatus(spool);
  const c = STATUS_COLOR[st];
  return (
    <div style={{
      border: `1.5px solid ${c.ring}`,
      boxShadow: `0 0 12px ${c.glow}`,
      background: "rgba(15,23,42,0.95)",
      borderRadius: 8,
      padding: "12px 14px",
      minWidth: 160,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke={c.ring} strokeWidth="1.5" />
          <circle cx="8" cy="8" r="3" stroke={c.ring} strokeWidth="1" opacity="0.6" />
          <circle cx="8" cy="8" r="1" fill={c.ring} />
        </svg>
        <span style={{ color: c.label, fontWeight: 700, fontSize: 12 }}>SPOOL</span>
        <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: c.ring, boxShadow: `0 0 5px ${c.glow}` }} />
      </div>

      {spool ? (
        <>
          <MetaLine label="File entrante" value={spool.inbound_queue?.length ?? 0} unit="session(s)" />
          <MetaLine label="Traitées/jour" value={spool.processed_today ?? "—"} />
          <MetaLine label="Vers NAS" value={spool.forwarded_to_nas ?? "—"} />
          <MetaLine label="Échecs" value={spool.failed ?? 0} color={spool.failed > 0 ? "#ef4444" : undefined} />
          {spool.current_transfer && (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Transfert en cours</p>
              <MetaLine label={`PC-${String(spool.current_transfer.from_pc).padStart(2,"0")}`} value={`${spool.current_transfer.progress_pct}%`} color="#f59e0b" />
              <MetaLine label="Vitesse" value={`${spool.current_transfer.speed_mbps} Mb/s`} />
              <ProgressBar pct={spool.current_transfer.progress_pct} color="#f59e0b" />
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "#4b5563", fontSize: 10, textAlign: "center", marginTop: 8 }}>Hors-ligne</p>
      )}
    </div>
  );
}

// ── Carte NAS ─────────────────────────────────────────────────────────────────
function NasCard({ nas }) {
  const st = nasStatus(nas);
  const c = STATUS_COLOR[st];
  const diskPct = nas ? Math.round((nas.disk_used_gb / nas.disk_total_gb) * 100) : 0;

  return (
    <div style={{
      border: `1.5px solid ${c.ring}`,
      boxShadow: `0 0 12px ${c.glow}`,
      background: "rgba(15,23,42,0.95)",
      borderRadius: 8,
      padding: "12px 14px",
      minWidth: 160,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="10" rx="2" stroke={c.ring} strokeWidth="1.2" />
          <rect x="3" y="6" width="3" height="1.5" rx="0.5" fill={c.ring} opacity="0.7" />
          <rect x="3" y="9" width="3" height="1.5" rx="0.5" fill={c.ring} opacity="0.4" />
          <circle cx="12" cy="8" r="1.2" fill={c.ring} />
        </svg>
        <span style={{ color: c.label, fontWeight: 700, fontSize: 12 }}>NAS</span>
        <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: c.ring, boxShadow: `0 0 5px ${c.glow}` }} />
      </div>

      {nas ? (
        <>
          <MetaLine label="Sessions" value={nas.total_sessions?.toLocaleString() ?? "—"} />
          <MetaLine label="Disque" value={`${nas.disk_used_gb} / ${nas.disk_total_gb} Go`} />
          <ProgressBar pct={diskPct} color={diskPct > 80 ? "#ef4444" : diskPct > 60 ? "#f59e0b" : "#22d3ee"} />
          {nas.last_write && (
            <>
              <p style={{ color: "#6b7280", fontSize: 9, marginTop: 8, marginBottom: 2 }}>Dernière écriture</p>
              <MetaLine label={nas.last_write.session_id} value={`${nas.last_write.size_mb} Mo`} />
            </>
          )}
        </>
      ) : (
        <p style={{ color: "#4b5563", fontSize: 10, textAlign: "center", marginTop: 8 }}>Hors-ligne</p>
      )}
    </div>
  );
}

function MetaLine({ label, value, unit, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: color ?? "#e2e8f0", fontWeight: color ? 600 : 400 }}>
        {value}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 4, marginTop: 4 }}>
      <div style={{
        width: `${Math.min(100, pct)}%`,
        height: "100%",
        background: color ?? "#22d3ee",
        borderRadius: 3,
        transition: "width 0.5s",
        boxShadow: `0 0 6px ${color}66`,
      }} />
    </div>
  );
}

// ── Légende ───────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { st: "active",  label: "Actif" },
    { st: "sending", label: "Envoi en cours" },
    { st: "queued",  label: "File en attente" },
    { st: "offline", label: "Hors-ligne" },
    { st: "error",   label: "Erreur" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      {items.map(({ st, label }) => (
        <div key={st} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: STATUS_COLOR[st].ring,
            boxShadow: `0 0 4px ${STATUS_COLOR[st].glow}`,
            display: "inline-block",
          }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SalleRecoltePage() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selectedPc, setSelectedPc] = useState(null);
  const REFRESH_MS = 3000;

  const load = useCallback(async () => {
    try {
      const res = await fetchSalleRecolte();
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const pcs = data?.pcs ?? Array.from({ length: 30 }, (_, i) => ({
    source: "pc", pc_id: i + 1,
    hostname: `pc-${String(i+1).padStart(2,"0")}`,
    timestamp: null, sqlite_queue: null, last_send: null, _offline: true,
  }));

  // Compter les états
  const stats = pcs.reduce((acc, pc) => {
    const s = pcStatus(pc);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const selectedPcData = selectedPc !== null ? pcs.find(p => p.pc_id === selectedPc) : null;

  // Layout de la grille : 3 rangées de 10
  const rows = [pcs.slice(0, 10), pcs.slice(10, 20), pcs.slice(20, 30)];

  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(135deg, #020817 0%, #0a1628 50%, #020817 100%)",
      padding: "24px",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    }}>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>
            SALLE DE RÉCOLTE
          </h1>
          <p style={{ color: "#4b5563", fontSize: 11, margin: "3px 0 0" }}>
            Surveillance temps-réel · Kafka topic2 · {REFRESH_MS / 1000}s
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Legend />
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
            background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: data?.connected ? "#22d3ee" : "#ef4444",
              boxShadow: data?.connected ? "0 0 5px rgba(34,211,238,0.6)" : "0 0 5px rgba(239,68,68,0.6)",
            }} />
            <span style={{ color: data?.connected ? "#22d3ee" : "#ef4444", fontSize: 10, fontWeight: 600 }}>
              {data?.connected ? "KAFKA CONNECTÉ" : "KAFKA DÉCONNECTÉ"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Actifs",           value: stats.active  ?? 0, color: "#22c55e" },
          { label: "En envoi",         value: stats.sending ?? 0, color: "#f59e0b" },
          { label: "File d'attente",   value: stats.queued  ?? 0, color: "#6366f1" },
          { label: "Hors-ligne",       value: stats.offline ?? 0, color: "#4b5563" },
          { label: "Erreur",           value: stats.error   ?? 0, color: "#ef4444" },
          { label: "Total postes",     value: 30,                 color: "#e2e8f0" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <span style={{ color, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</span>
            <span style={{ color: "#4b5563", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</span>
          </div>
        ))}
        {data?.last_update && (
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center",
            color: "#374151", fontSize: 9,
          }}>
            Dernière màj : {new Date(data.last_update).toLocaleTimeString("fr-FR")}
          </div>
        )}
      </div>

      {/* Zone principale : blueprint + panneau détail */}
      <div style={{ position: "relative" }}>
        <div style={{
          display: "flex",
          gap: 24,
          transition: "margin-right 0.3s",
          marginRight: selectedPc ? 316 : 0,
        }}>

          {/* ── BLUEPRINT SALLE ───────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            border: "2px solid rgba(99,102,241,0.5)",
            borderRadius: 12,
            background: "rgba(6,12,30,0.95)",
            padding: 24,
            position: "relative",
            boxShadow: "0 0 40px rgba(99,102,241,0.1), inset 0 0 60px rgba(0,0,50,0.5)",
          }}>
            {/* Grid lines background */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden",
              backgroundImage: `
                linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
              pointerEvents: "none",
            }} />

            {/* Label blueprint */}
            <div style={{
              position: "absolute", top: -11, left: 20,
              background: "#020817",
              padding: "0 10px",
              color: "rgba(99,102,241,0.7)", fontSize: 9, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 2,
            }}>
              SALLE DE RÉCOLTE · PLAN DE SALLE
            </div>
            <div style={{
              position: "absolute", top: -11, right: 20,
              background: "#020817",
              padding: "0 10px",
              color: "rgba(99,102,241,0.4)", fontSize: 9,
            }}>
              30 POSTES · SCHÉMA v1
            </div>

            {/* ── POSTES D'ENREGISTREMENT ─────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <p style={{
                color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 2, marginBottom: 12,
              }}>
                POSTES D'ENREGISTREMENT
              </p>

              {rows.map((row, rowIdx) => (
                <div key={rowIdx} style={{ marginBottom: 12 }}>
                  {/* Rangée label */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                  }}>
                    <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 8, width: 40 }}>
                      RANGÉE {rowIdx + 1}
                    </span>
                    {/* Table (bureau) */}
                    <div style={{
                      flex: 1,
                      background: "rgba(99,102,241,0.04)",
                      border: "1px solid rgba(99,102,241,0.12)",
                      borderRadius: 6,
                      padding: "10px 12px",
                      display: "flex", gap: 8, justifyContent: "center",
                      flexWrap: "nowrap",
                    }}>
                      {row.map((pc) => (
                        <PcBox
                          key={pc.pc_id}
                          pc={pc}
                          selected={selectedPc === pc.pc_id}
                          onClick={() => setSelectedPc(selectedPc === pc.pc_id ? null : pc.pc_id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── INFRASTRUCTURE (Spool + NAS) ────────────────────────────── */}
            <div style={{
              borderTop: "1px solid rgba(99,102,241,0.2)",
              paddingTop: 16,
            }}>
              <p style={{
                color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 2, marginBottom: 12,
              }}>
                INFRASTRUCTURE
              </p>

              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                {/* Ligne de flux PC → Spool → NAS */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 0, background: "rgba(15,23,42,0.5)",
                  border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "12px 16px",
                }}>
                  <SpoolCard spool={data?.spool ?? null} />

                  {/* Flèche Spool → NAS */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px", gap: 4 }}>
                    <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 8 }}>NFS</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 50, height: 1, background: "linear-gradient(90deg, rgba(99,102,241,0.4), rgba(34,211,238,0.4))" }} />
                      <span style={{ color: "rgba(34,211,238,0.6)", fontSize: 12 }}>▶</span>
                    </div>
                    <span style={{ color: "rgba(99,102,241,0.3)", fontSize: 7 }}>192.168.88.x</span>
                  </div>

                  <NasCard nas={data?.nas ?? null} />
                </div>

                {/* Indicateur de flux global PC → Spool */}
                <div style={{
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  background: "rgba(15,23,42,0.5)", border: "1px solid rgba(99,102,241,0.15)",
                  borderRadius: 10, padding: "12px 20px", gap: 8, minWidth: 160,
                }}>
                  <p style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
                    FLUX POSTES → SPOOL
                  </p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(34,197,94,0.5), rgba(99,102,241,0.5))" }} />
                    <span style={{ color: "rgba(99,102,241,0.5)", fontSize: 14 }}>→</span>
                  </div>
                  <MetaLine label="Envois actifs" value={stats.sending ?? 0} color="#f59e0b" />
                  <MetaLine label="En attente" value={
                    pcs.reduce((acc, pc) => acc + (pc.sqlite_queue?.pending_sessions ?? 0), 0)
                  } />
                </div>
              </div>
            </div>

            {/* Erreurs Kafka */}
            {data?.errors?.length > 0 && (
              <div style={{
                marginTop: 16, background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 10,
              }}>
                <p style={{ color: "#ef4444", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  ERREURS KAFKA
                </p>
                {data.errors.slice(-3).map((e, i) => (
                  <p key={i} style={{ color: "#9ca3af", fontSize: 9, margin: "2px 0" }}>
                    {new Date(e.ts).toLocaleTimeString("fr-FR")} · {e.msg}
                  </p>
                ))}
              </div>
            )}

            {loading && !data && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                background: "rgba(2,8,23,0.8)", borderRadius: 10,
              }}>
                <p style={{ color: "#6366f1", fontSize: 12, letterSpacing: 2 }}>CONNEXION AU KAFKA…</p>
              </div>
            )}
          </div>
        </div>

        {/* Panneau de détail PC */}
        {selectedPcData && (
          <PcDetailPanel pc={selectedPcData} onClose={() => setSelectedPc(null)} />
        )}
      </div>
    </div>
  );
}
