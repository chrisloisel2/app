import { useEffect, useState, useRef, useCallback, memo } from "react";

// ── Couleurs de statut ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  online:       { ring: "#22d3ee", glow: "rgba(34,211,238,0.35)", label: "#22d3ee" },
  active:       { ring: "#22c55e", glow: "rgba(34,197,94,0.35)",  label: "#22c55e" },
  sending:      { ring: "#f59e0b", glow: "rgba(245,158,11,0.35)", label: "#f59e0b" },
  queued:       { ring: "#6366f1", glow: "rgba(99,102,241,0.35)", label: "#6366f1" },
  disconnected: { ring: "#dc2626", glow: "rgba(220,38,38,0.25)",  label: "#f87171" },
  never_seen:   { ring: "#1f2937", glow: "rgba(31,41,55,0.10)",   label: "#374151" },
  error:        { ring: "#ef4444", glow: "rgba(239,68,68,0.35)",  label: "#ef4444" },
  degraded:     { ring: "#f97316", glow: "rgba(249,115,22,0.35)", label: "#f97316" },
  offline:      { ring: "#374151", glow: "rgba(55,65,81,0.15)",   label: "#6b7280" },
};

// Un PC est "offline" seulement si un message explicite "disconnected: true" est reçu.
// S'il n'a jamais été vu → "never_seen" (case grisée vide).
// S'il a été vu au moins une fois sans message de déconnexion → connecté (actif / envoi / file).
function pcStatus(pc) {
  if (pc._never_seen)   return "never_seen";
  if (pc._disconnected) return "disconnected";
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
const PcBox = memo(function PcBox({ pc, selected, onClick }) {
  const handleClick = useCallback(() => onClick(pc.pc_id), [onClick, pc.pc_id]);
  const st = pcStatus(pc);
  const c = STATUS_COLOR[st];
  const queue        = pc.sqlite_queue?.pending_sessions ?? null;
  const isRecording  = pc.is_recording;
  const hasAlert     = pc.has_alert;
  const operator     = pc.operator_username;

  // Couleur de bordure : alerte > enregistrement > statut normal
  const borderColor = hasAlert ? "#ef4444" : isRecording ? "#a855f7" : c.ring;
  const glowColor   = hasAlert
    ? "rgba(239,68,68,0.4)"
    : isRecording
    ? "rgba(168,85,247,0.4)"
    : c.glow;

  const title = [
    pc.hostname || `PC-${String(pc.pc_id).padStart(5,"0")}`,
    operator ? `Opérateur : ${operator}` : null,
    isRecording ? "● Enregistrement en cours" : null,
    hasAlert    ? "⚠ Alerte" : null,
  ].filter(Boolean).join("\n");

  return (
    <div
      onClick={handleClick}
      title={title}
      style={{
        border: `1.5px solid ${selected ? "#93c5fd" : borderColor}`,
        boxShadow: selected
          ? `0 0 0 2px #3b82f6, 0 0 10px ${glowColor}`
          : `0 0 6px ${glowColor}`,
        background: hasAlert
          ? "rgba(40,10,10,0.95)"
          : isRecording
          ? "rgba(30,10,45,0.95)"
          : "rgba(15,23,42,0.9)",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        borderRadius: 4,
        padding: "4px 3px 3px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 52,
      }}
    >
      {/* PC ID */}
      <span style={{ color: hasAlert ? "#f87171" : c.label, fontSize: 8, fontWeight: 700 }}>
        {String(pc.pc_id).padStart(5, "0")}
      </span>

      {/* Monitor icon */}
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="16" height="10" rx="1.5"
          stroke={hasAlert ? "#ef4444" : isRecording ? "#a855f7" : c.ring}
          strokeWidth="1.2" fill="rgba(15,23,42,0.6)" />
        <rect x="7" y="11" width="4" height="1.5" rx="0.5"
          fill={hasAlert ? "#ef4444" : isRecording ? "#a855f7" : c.ring} opacity="0.6" />
        <rect x="5" y="12.5" width="8" height="0.8" rx="0.4"
          fill={hasAlert ? "#ef4444" : isRecording ? "#a855f7" : c.ring} opacity="0.4" />
        {/* Écran actif si enregistrement */}
        {isRecording && !hasAlert && (
          <rect x="3" y="3" width="12" height="6" rx="0.5" fill="#a855f7" opacity="0.2" />
        )}
      </svg>

      {/* Nom opérateur */}
      {operator && (
        <span style={{
          color: hasAlert ? "#fca5a5" : isRecording ? "#d8b4fe" : "#94a3b8",
          fontSize: 6,
          fontWeight: 600,
          maxWidth: 50,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}>
          {operator}
        </span>
      )}

      {/* Badges REC + ALERT */}
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {isRecording && (
          <span style={{
            background: "#7c3aed",
            color: "#fff",
            fontSize: 6,
            fontWeight: 700,
            borderRadius: 2,
            padding: "0 2px",
            lineHeight: "10px",
          }}>REC</span>
        )}
        {hasAlert && (
          <span style={{
            background: "#dc2626",
            color: "#fff",
            fontSize: 6,
            fontWeight: 700,
            borderRadius: 2,
            padding: "0 2px",
            lineHeight: "10px",
          }}>⚠</span>
        )}
        {queue !== null && queue > 0 && !isRecording && !hasAlert && (
          <span style={{
            background: "#6366f1",
            color: "#fff",
            fontSize: 6,
            fontWeight: 700,
            borderRadius: 2,
            padding: "0 2px",
            lineHeight: "10px",
          }}>{queue}</span>
        )}
      </div>

      {/* Pulse dot top-right */}
      <span style={{
        position: "absolute",
        top: 3,
        right: 3,
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: borderColor,
        boxShadow: `0 0 4px ${glowColor}`,
      }} />
    </div>
  );
});

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
          {pc.hostname || `PC-${String(pc.pc_id).padStart(5, "0")}`}
        </span>
        <button
          onClick={onClose}
          style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
        >✕</button>
      </div>

      <Row label="ID" value={`PC-${String(pc.pc_id).padStart(5, "0")}`} />
      <Row label="Opérateur" value={pc.operator_username ?? "—"} color={pc.operator_username ? "#e2e8f0" : "#4b5563"} />
      <Row label="Enregistrement" value={pc.is_recording ? "● EN COURS" : "Inactif"}
        color={pc.is_recording ? "#a855f7" : "#4b5563"} />
      <Row label="Alerte" value={pc.has_alert ? "⚠ OUI" : "Non"}
        color={pc.has_alert ? "#ef4444" : "#4b5563"} />
      <Row label="Statut" value={st.toUpperCase()} color={c.label} />
      <Row label="Vu le" value={pc.timestamp ? new Date(pc.timestamp).toLocaleString("fr-FR") : "—"} />

      {pc._disconnected && (
        <div style={{
          background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)",
          borderRadius: 5, padding: "6px 10px", marginTop: 8,
        }}>
          <p style={{ color: "#f87171", fontSize: 10, margin: 0 }}>
            Message de déconnexion reçu. Les dernières données connues sont affichées.
          </p>
        </div>
      )}

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
              <MetaLine label={`PC-${String(spool.current_transfer.from_pc).padStart(5,"0")}`} value={`${spool.current_transfer.progress_pct}%`} color="#f59e0b" />
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
    { color: "#22c55e",  label: "Actif" },
    { color: "#a855f7",  label: "Enregistrement" },
    { color: "#ef4444",  label: "Alerte" },
    { color: "#f59e0b",  label: "Envoi" },
    { color: "#6366f1",  label: "File" },
    { color: "#dc2626",  label: "Déconnecté" },
    { color: "#1f2937",  label: "Inconnu" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color,
            boxShadow: `0 0 4px ${color}66`,
            display: "inline-block",
          }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Champs visuels qui déclenchent un re-render si changés ───────────────────
function pcVisualKey(pc) {
  return [
    pc._never_seen ? "n" : pc._disconnected ? "d" : "c",
    pc.operator_username ?? "",
    pc.is_recording ? 1 : 0,
    pc.has_alert ? 1 : 0,
    pc.sqlite_queue?.pending_sessions ?? 0,
    pc.sqlite_queue?.total_records ?? 0,
    pc.last_send?.status ?? "",
    pc.last_send?.session_id ?? "",
    pc.last_send?.records_sent ?? 0,
  ].join("|");
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SalleRecoltePage() {
  // PCs stockés par pc_id pour éviter de remplacer un objet stable
  const [pcsMap, setPcsMap]         = useState(() => new Map());
  const [meta, setMeta]             = useState({ connected: false, last_update: null, errors: [] });
  const [spool, setSpool]           = useState(null);
  const [nas, setNas]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selectedPc, setSelectedPc] = useState(null);

  // Garder les clés visuelles précédentes pour comparaison
  const prevKeysRef  = useRef({});
  const prevSpoolRef = useRef(null);
  const prevNasRef   = useRef(null);
  const prevMetaRef  = useRef(null);

  // Callback stable pour les clics PcBox (ne change jamais de référence)
  const handlePcClick = useCallback((pcId) => {
    setSelectedPc(prev => prev === pcId ? null : pcId);
  }, []);

  const handleMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── Meta (connected, last_update, errors) — seulement si changé ──
    const metaKey = `${msg.connected}|${msg.last_update}|${(msg.errors ?? []).length}`;
    if (metaKey !== prevMetaRef.current) {
      prevMetaRef.current = metaKey;
      setMeta({ connected: msg.connected, last_update: msg.last_update, errors: msg.errors ?? [] });
    }
    setLoading(false);
    setError(null);

    // ── Spool : mise à jour seulement si changé ──
    const spoolKey = JSON.stringify(msg.spool ?? null);
    if (spoolKey !== prevSpoolRef.current) {
      prevSpoolRef.current = spoolKey;
      setSpool(msg.spool ?? null);
    }

    // ── NAS : mise à jour seulement si changé ──
    const nasKey = JSON.stringify(msg.nas ?? null);
    if (nasKey !== prevNasRef.current) {
      prevNasRef.current = nasKey;
      setNas(msg.nas ?? null);
    }

    // ── PCs : ne remplacer que ceux qui ont changé ──
    const incoming = msg.pcs ?? [];
    const changed = [];
    for (const pc of incoming) {
      const key = pcVisualKey(pc);
      if (prevKeysRef.current[pc.pc_id] !== key) {
        prevKeysRef.current[pc.pc_id] = key;
        changed.push(pc);
      }
    }
    if (changed.length > 0) {
      setPcsMap(prev => {
        const next = new Map(prev);
        for (const pc of changed) next.set(pc.pc_id, pc);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/salle");
        const msg = await res.json();
        if (active) handleMessage(JSON.stringify(msg));
      } catch {
        if (active) setError("Erreur de connexion…");
      }
      if (active) setTimeout(poll, 50);
    };
    poll();
    return () => { active = false; };
  }, [handleMessage]);

  const pcs = Array.from({ length: 30 }, (_, i) => {
    const id = i + 1;
    return pcsMap.get(id) ?? {
      source: "pc", pc_id: id,
      hostname: `PC-${String(id).padStart(5, "0")}`,
      timestamp: null, sqlite_queue: null, last_send: null, _never_seen: true,
    };
  });

  // Compter les états
  const stats = pcs.reduce((acc, pc) => {
    const s = pcStatus(pc);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const selectedPcData = selectedPc !== null ? pcs.find(p => p.pc_id === selectedPc) : null;

  // Layout serpentin 6 rangées de 5 :
  //  →  1  2  3  4  5
  //  →  6  7  8  9 10
  //  ← 15 14 13 12 11
  //  → 16 17 18 19 20
  //  ← 25 24 23 22 21
  //  → 26 27 28 29 30
  const pcById = Object.fromEntries(pcs.map(p => [p.pc_id, p]));
  const SNAKE_ORDER = [
    [1,  2,  3,  4,  5],
    [6,  7,  8,  9,  10],
    [15, 14, 13, 12, 11],
    [16, 17, 18, 19, 20],
    [25, 24, 23, 22, 21],
    [26, 27, 28, 29, 30],
  ];
  const rows = SNAKE_ORDER.map(ids => ids.map(id => pcById[id]));

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
            Surveillance temps-réel · Kafka topic2 · SSE
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
              background: meta.connected ? "#22d3ee" : "#ef4444",
              boxShadow: meta.connected ? "0 0 5px rgba(34,211,238,0.6)" : "0 0 5px rgba(239,68,68,0.6)",
            }} />
            <span style={{ color: meta.connected ? "#22d3ee" : "#ef4444", fontSize: 10, fontWeight: 600 }}>
              {meta.connected ? "KAFKA CONNECTÉ" : "KAFKA DÉCONNECTÉ"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Actifs",           value: stats.active       ?? 0, color: "#22c55e" },
          { label: "En envoi",         value: stats.sending      ?? 0, color: "#f59e0b" },
          { label: "File d'attente",   value: stats.queued       ?? 0, color: "#6366f1" },
          { label: "Déconnectés",      value: stats.disconnected ?? 0, color: "#f87171" },
          { label: "Non enregistrés",  value: stats.never_seen   ?? 0, color: "#374151" },
          { label: "Total postes",     value: 30,                      color: "#e2e8f0" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <span style={{ color, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</span>
            <span style={{ color: "#4b5563", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</span>
          </div>
        ))}
        {meta.last_update && (
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center",
            color: "#374151", fontSize: 9,
          }}>
            Dernière màj : {new Date(meta.last_update).toLocaleTimeString("fr-FR")}
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

              {rows.map((row, rowIdx) => {
                // Rangées 3 et 5 (indices 2 et 4) sont en sens inverse (←)
                const isReversed = rowIdx === 2 || rowIdx === 4;
                const arrow = isReversed ? "←" : "→";
                return (
                <div key={rowIdx} style={{ marginBottom: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                  }}>
                    <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 8, width: 52, flexShrink: 0 }}>
                      {arrow} R{rowIdx + 1}
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
                          onClick={handlePcClick}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
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
                  <SpoolCard spool={spool} />

                  {/* Flèche Spool → NAS */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px", gap: 4 }}>
                    <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 8 }}>NFS</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 50, height: 1, background: "linear-gradient(90deg, rgba(99,102,241,0.4), rgba(34,211,238,0.4))" }} />
                      <span style={{ color: "rgba(34,211,238,0.6)", fontSize: 12 }}>▶</span>
                    </div>
                    <span style={{ color: "rgba(99,102,241,0.3)", fontSize: 7 }}>192.168.88.x</span>
                  </div>

                  <NasCard nas={nas} />
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
            {meta.errors?.length > 0 && (
              <div style={{
                marginTop: 16, background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 10,
              }}>
                <p style={{ color: "#ef4444", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  ERREURS KAFKA
                </p>
                {meta.errors.slice(-3).map((e, i) => (
                  <p key={i} style={{ color: "#9ca3af", fontSize: 9, margin: "2px 0" }}>
                    {new Date(e.ts).toLocaleTimeString("fr-FR")} · {e.msg}
                  </p>
                ))}
              </div>
            )}

            {loading && pcsMap.size === 0 && (
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
