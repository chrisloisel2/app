import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";

// ── Couleurs de statut ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  active:       { ring: "#22c55e", glow: "rgba(34,197,94,0.35)",  label: "#22c55e" },
  recording:    { ring: "#a855f7", glow: "rgba(168,85,247,0.35)", label: "#a855f7" },
  uploading:    { ring: "#f59e0b", glow: "rgba(245,158,11,0.35)", label: "#f59e0b" },
  queued:       { ring: "#6366f1", glow: "rgba(99,102,241,0.35)", label: "#6366f1" },
  disconnected: { ring: "#dc2626", glow: "rgba(220,38,38,0.25)",  label: "#f87171" },
  never_seen:   { ring: "#1f2937", glow: "rgba(31,41,55,0.10)",   label: "#374151" },
};

// station_id → pc_id numérique (ex: "PC-03" → 3)
function stationToPcId(station_id) {
  const m = String(station_id).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function stationStatus(st) {
  if (!st || st._never_seen)   return "never_seen";
  if (!st.connected)           return "disconnected";
  if (st.recording?.is_recording) return "recording";
  if (st.upload?.status === "sending" || st.upload?.status === "queued") return "uploading";
  return "active";
}

// ── PC Box ────────────────────────────────────────────────────────────────────
const PcBox = memo(function PcBox({ pc, selected, onClick }) {
  const pcId = pc.pc_id;
  const handleClick = useCallback(() => onClick(pcId), [onClick, pcId]);
  const st = stationStatus(pc);
  const c  = STATUS_COLOR[st];

  const isRecording = pc.recording?.is_recording;
  const hasAlert    = pc.alert;
  const operator    = pc.operator;

  const borderColor = hasAlert ? "#ef4444" : isRecording ? "#a855f7" : c.ring;
  const glowColor   = hasAlert
    ? "rgba(239,68,68,0.4)"
    : isRecording
    ? "rgba(168,85,247,0.4)"
    : c.glow;

  const title = [
    pc.station_id || `PC-${String(pcId).padStart(5, "0")}`,
    operator ? `Opérateur : ${operator}` : null,
    pc.scenario ? `Scénario : ${pc.scenario}` : null,
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
        {String(pcId).padStart(5, "0")}
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

      {/* Badges */}
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {isRecording && (
          <span style={{
            background: "#7c3aed", color: "#fff",
            fontSize: 6, fontWeight: 700, borderRadius: 2,
            padding: "0 2px", lineHeight: "10px",
          }}>REC</span>
        )}
        {hasAlert && (
          <span style={{
            background: "#dc2626", color: "#fff",
            fontSize: 6, fontWeight: 700, borderRadius: 2,
            padding: "0 2px", lineHeight: "10px",
          }}>⚠</span>
        )}
        {pc.upload?.status === "queued" && !isRecording && !hasAlert && (
          <span style={{
            background: "#6366f1", color: "#fff",
            fontSize: 6, fontWeight: 700, borderRadius: 2,
            padding: "0 2px", lineHeight: "10px",
          }}>Q</span>
        )}
        {pc.upload?.status === "sending" && !isRecording && !hasAlert && (
          <span style={{
            background: "#f59e0b", color: "#fff",
            fontSize: 6, fontWeight: 700, borderRadius: 2,
            padding: "0 2px", lineHeight: "10px",
          }}>⬆</span>
        )}
      </div>

      {/* Pulse dot top-right */}
      <span style={{
        position: "absolute", top: 3, right: 3,
        width: 5, height: 5, borderRadius: "50%",
        background: borderColor,
        boxShadow: `0 0 4px ${glowColor}`,
      }} />
    </div>
  );
});

// ── Panel de détail station ───────────────────────────────────────────────────
function PcDetailPanel({ pc, onClose }) {
  if (!pc) return null;
  const st = stationStatus(pc);
  const c  = STATUS_COLOR[st];

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 300,
      background: "rgba(2,8,23,0.97)",
      border: "1px solid rgba(99,102,241,0.4)",
      borderRadius: 8, padding: 16, overflowY: "auto", zIndex: 10,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: c.label, fontWeight: 700, fontSize: 14 }}>
          {pc.station_id}
        </span>
        <button
          onClick={onClose}
          style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
        >✕</button>
      </div>

      <Row label="Opérateur" value={pc.operator || "—"} color={pc.operator ? "#e2e8f0" : "#4b5563"} />
      <Row label="Scénario"  value={pc.scenario  || "—"} color={pc.scenario  ? "#94a3b8" : "#4b5563"} />
      <Row label="Statut"    value={st.toUpperCase()} color={c.label} />
      <Row label="Enregistrement" value={pc.recording?.is_recording ? "● EN COURS" : "Inactif"}
        color={pc.recording?.is_recording ? "#a855f7" : "#4b5563"} />
      <Row label="Alerte" value={pc.alert ? "⚠ OUI" : "Non"}
        color={pc.alert ? "#ef4444" : "#4b5563"} />
      <Row label="MAJ" value={pc.last_ts ? new Date(pc.last_ts * 1000).toLocaleTimeString("fr-FR") : "—"} />

      {!pc.connected && !pc._never_seen && (
        <div style={{
          background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)",
          borderRadius: 5, padding: "6px 10px", marginTop: 8,
        }}>
          <p style={{ color: "#f87171", fontSize: 10, margin: 0 }}>Station déconnectée.</p>
        </div>
      )}

      {/* Trackers */}
      {pc.trackers && Object.keys(pc.trackers).length > 0 && (
        <>
          <Divider label="Trackers" />
          {Object.values(pc.trackers).map(t => (
            <Row
              key={t.idx}
              label={`T${t.idx} ${t.serial || ""}`}
              value={t.tracking ? "● OK" : "▲ PERDU"}
              color={t.tracking ? "#22c55e" : "#f59e0b"}
            />
          ))}
        </>
      )}

      {/* Grippers */}
      {pc.grippers && (
        <>
          <Divider label="Grippers" />
          <Row label="Droit"  value={pc.grippers.right?.connected ? `● ${pc.grippers.right.port || "connecté"}` : "○ déconnecté"}
            color={pc.grippers.right?.connected ? "#22c55e" : "#4b5563"} />
          <Row label="Gauche" value={pc.grippers.left?.connected  ? `● ${pc.grippers.left.port  || "connecté"}` : "○ déconnecté"}
            color={pc.grippers.left?.connected  ? "#22c55e" : "#4b5563"} />
        </>
      )}

      {/* Caméras */}
      {pc.cameras?.length > 0 && (
        <>
          <Divider label="Caméras" />
          {pc.cameras.map((cam, i) => (
            <Row key={i}
              label={`Cam ${cam.position || i}`}
              value={cam.db_match ? "✓ reconnue" : "? inconnue"}
              color={cam.db_match ? "#22c55e" : "#f59e0b"}
            />
          ))}
        </>
      )}

      {/* Upload */}
      {pc.upload && (
        <>
          <Divider label="Upload" />
          <Row label="Statut"  value={pc.upload.status}     color={
            pc.upload.status === "success" ? "#22c55e" :
            pc.upload.status === "failed"  ? "#ef4444" : "#f59e0b"
          } />
          <Row label="Session" value={pc.upload.session_id || "—"} />
          {pc.upload.error && <Row label="Erreur" value={pc.upload.error} color="#ef4444" />}
        </>
      )}

      {/* Recording */}
      {pc.recording && (
        <>
          <Divider label="Enregistrement" />
          <Row label="Déclencheur" value={pc.recording.trigger || "—"} />
          <Row label="Durée" value={pc.recording.duration_s ? `${pc.recording.duration_s.toFixed(1)}s` : "—"} />
          {pc.recording.failed && <Row label="Échec" value="OUI" color="#ef4444" />}
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

// ── Légende ───────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "#22c55e", label: "Actif"          },
    { color: "#a855f7", label: "Enregistrement" },
    { color: "#ef4444", label: "Alerte"         },
    { color: "#f59e0b", label: "Upload"         },
    { color: "#6366f1", label: "File"           },
    { color: "#dc2626", label: "Déconnecté"     },
    { color: "#1f2937", label: "Inconnu"        },
  ];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color, boxShadow: `0 0 4px ${color}66`,
            display: "inline-block",
          }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Spool components ─────────────────────────────────────────────────────────

function spoolPipelineLabel(sess) {
  const ps = sess.pipeline_status;
  if (ps === "completed")               return { label: "✓ Complété",          color: "#22c55e" };
  if (ps === "inspection_failed")       return { label: "✗ Inspection KO",     color: "#ef4444" };
  if (ps === "upload_failed")           return { label: "✗ Upload KO",         color: "#ef4444" };
  if (ps === "quarantine_upload_failed")return { label: "✗ Quarantaine KO",    color: "#ef4444" };
  if (ps === "inspection_passed")       return { label: "✓ Insp. OK → Upload", color: "#f59e0b" };
  if (sess.step === "upload")           return { label: "⬆ Upload…",           color: "#f59e0b" };
  if (sess.step === "inspection")       return { label: "🔍 Inspection…",       color: "#6366f1" };
  if (sess.step === "pipeline")         return { label: "⚙ Pipeline…",         color: "#6366f1" };
  return                                       { label: sess.step + "/" + sess.status, color: "#64748b" };
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 4, marginTop: 4 }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: "100%",
        background: color ?? "#22d3ee",
        borderRadius: 3,
        transition: "width 0.4s",
        boxShadow: `0 0 6px ${color}66`,
      }} />
    </div>
  );
}

function ActiveSessionCard({ sess }) {
  const { label, color } = spoolPipelineLabel(sess);
  const up = sess.upload;
  const insp = sess.inspection;
  const uploadPct = up.file_total > 0
    ? Math.round((up.files_uploaded / up.file_total) * 100)
    : 0;
  const shortId = sess.session_id.replace(/^session_/, "");

  return (
    <div style={{
      background: "rgba(6,12,30,0.9)",
      border: "1px solid rgba(99,102,241,0.25)",
      borderRadius: 6,
      padding: "10px 12px",
      minWidth: 220,
      flex: "1 1 220px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}>{shortId}</span>
        <span style={{ color, fontSize: 10, fontWeight: 700 }}>{label}</span>
      </div>

      {/* Inspection */}
      {insp.total_checks > 0 && (
        <div style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
            <span style={{ color: "#475569" }}>Inspection</span>
            <span style={{ color: insp.ok === false ? "#ef4444" : insp.ok === true ? "#22c55e" : "#f59e0b" }}>
              {insp.ok === null ? `${insp.total_checks} checks…` : insp.ok ? `${insp.total_checks} checks ✓` : `${insp.failed_checks.length} erreurs`}
            </span>
          </div>
          {insp.ok === false && insp.errors.slice(0, 2).map((e, i) => (
            <div key={i} style={{ color: "#f87171", fontSize: 9, fontFamily: "monospace", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {up.file_total > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
            <span style={{ color: "#475569" }}>
              {up.rel ? (
                <span style={{ fontFamily: "monospace", color: "#64748b", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "bottom" }}>
                  {up.rel.split("/").pop()}
                </span>
              ) : "Upload"}
            </span>
            <span style={{ color: "#f59e0b" }}>
              {up.files_uploaded}/{up.file_total}
              {up.speed_mbps > 0 && <span style={{ color: "#64748b" }}> · {up.speed_mbps.toFixed(1)} Mb/s</span>}
            </span>
          </div>
          <ProgressBar pct={uploadPct} color="#f59e0b" />
        </div>
      )}

      {/* Metadata */}
      {sess.metadata && (
        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sess.metadata.scenario && (
            <span style={{ color: "#6366f1", fontSize: 9 }}>{sess.metadata.scenario}</span>
          )}
          {sess.metadata.duration_seconds != null && (
            <span style={{ color: "#475569", fontSize: 9 }}>{sess.metadata.duration_seconds.toFixed(1)}s</span>
          )}
          {sess.metadata.cameras_count != null && (
            <span style={{ color: "#475569", fontSize: 9 }}>📷{sess.metadata.cameras_count}</span>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ sess, index }) {
  const { label, color } = spoolPipelineLabel(sess);
  const shortId = sess.session_id.replace(/^session_/, "");
  const bg = index % 2 === 0 ? "rgba(6,12,30,0.6)" : "rgba(10,16,32,0.6)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "5px 10px", background: bg,
      borderBottom: "1px solid rgba(99,102,241,0.06)",
      fontSize: 10, fontFamily: "monospace",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: sess.outcome === "ok" ? "#22c55e" : "#ef4444",
      }} />
      <span style={{ color: "#64748b", flexShrink: 0, fontSize: 9 }}>
        {sess.ts ? new Date(sess.ts * 1000).toLocaleTimeString("fr-FR") : "—"}
      </span>
      <span style={{ color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {shortId}
      </span>
      {sess.metadata?.scenario && (
        <span style={{ color: "#6366f1", fontSize: 9, flexShrink: 0 }}>{sess.metadata.scenario}</span>
      )}
      <span style={{ color, fontWeight: 600, flexShrink: 0 }}>{label}</span>
    </div>
  );
}

function SpoolSection({ spool }) {
  if (!spool) return null;
  const hasActivity = spool.active.length > 0 || spool.history.length > 0 || spool.consumer_ok;

  return (
    <div style={{
      marginTop: 20,
      border: "2px solid rgba(99,102,241,0.3)",
      borderRadius: 12,
      background: "rgba(6,12,30,0.95)",
      padding: 20,
      position: "relative",
      boxShadow: "0 0 20px rgba(99,102,241,0.06)",
    }}>
      {/* Label */}
      <div style={{
        position: "absolute", top: -11, left: 20,
        background: "#020817", padding: "0 10px",
        color: "rgba(99,102,241,0.7)", fontSize: 9, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 2,
      }}>
        SPOOL · INSPECT & UPLOAD
      </div>

      {/* Header stats */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        {/* Consumer status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: spool.consumer_ok ? "#22c55e" : "#ef4444",
            boxShadow: spool.consumer_ok ? "0 0 5px #22c55e88" : undefined,
          }} />
          <span style={{ color: spool.consumer_ok ? "#22c55e" : "#ef4444", fontSize: 10, fontWeight: 600 }}>
            {spool.consumer_ok ? "CONSUMER ACTIF" : "CONSUMER INACTIF"}
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: "rgba(99,102,241,0.2)" }} />

        {/* Counters */}
        <span style={{ color: "#64748b", fontSize: 10 }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>{spool.processed_total}</span> traitées
        </span>
        <span style={{ color: "#64748b", fontSize: 10 }}>
          <span style={{ color: spool.failed_total > 0 ? "#ef4444" : "#475569", fontWeight: 700 }}>{spool.failed_total}</span> échecs
        </span>
        <span style={{ color: "#64748b", fontSize: 10 }}>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>{spool.active.length}</span> en cours
        </span>
      </div>

      {!hasActivity && (
        <p style={{ color: "#1e293b", fontSize: 11, textAlign: "center", padding: "20px 0" }}>
          En attente de sessions…
        </p>
      )}

      {/* Sessions actives */}
      {spool.active.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            EN COURS ({spool.active.length})
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {spool.active.map(sess => (
              <ActiveSessionCard key={sess.session_id} sess={sess} />
            ))}
          </div>
        </div>
      )}

      {/* Historique */}
      {spool.history.length > 0 && (
        <div>
          <p style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            HISTORIQUE RÉCENT
          </p>
          <div style={{ border: "1px solid rgba(99,102,241,0.12)", borderRadius: 6, overflow: "hidden" }}>
            {spool.history.slice(0, 10).map((sess, i) => (
              <HistoryRow key={sess.session_id + i} sess={sess} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Clé visuelle (évite re-render inutile) ───────────────────────────────────
function stationVisualKey(st) {
  return [
    st._never_seen ? "n" : st.connected ? "c" : "d",
    st.operator ?? "",
    st.scenario ?? "",
    st.alert ? 1 : 0,
    st.recording?.is_recording ? 1 : 0,
    st.recording?.failed ? 1 : 0,
    st.upload?.status ?? "",
    Object.keys(st.trackers || {}).length,
    st.grippers?.right?.connected ? 1 : 0,
    st.grippers?.left?.connected  ? 1 : 0,
  ].join("|");
}

// ── Horodatage isolé ──────────────────────────────────────────────────────────
function LastUpdateLabel({ lastUpdateRef }) {
  const [display, setDisplay] = useState("—");
  useEffect(() => {
    const tick = () => {
      const ts = lastUpdateRef.current;
      setDisplay(ts ? new Date(ts).toLocaleTimeString("fr-FR") : "—");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdateRef]);
  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", color: "#374151", fontSize: 9 }}>
      Dernière màj : {display}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SalleRecoltePage() {
  // Stations indexées par pc_id (int 1-30) extrait du station_id
  const [stationsMap, setStationsMap] = useState(() => new Map());
  const [meta, setMeta]               = useState({ connected: false, errors: [] });
  const [spool, setSpool]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selectedPc, setSelectedPc]   = useState(null);

  const prevKeysRef  = useRef({});
  const prevMetaRef  = useRef(null);
  const lastUpdateRef = useRef(null);

  const handlePcClick = useCallback((pcId) => {
    setSelectedPc(prev => prev === pcId ? null : pcId);
  }, []);

  const handleMessage = useCallback((msg) => {
    setLoading(prev => prev ? false : prev);
    setError(prev => prev ? null : prev);

    lastUpdateRef.current = msg.last_update;
    const metaKey = `${msg.connected}|${(msg.errors ?? []).length}`;
    if (metaKey !== prevMetaRef.current) {
      prevMetaRef.current = metaKey;
      setMeta({ connected: msg.connected, errors: msg.errors ?? [] });
    }

    if (msg.spool !== undefined) setSpool(msg.spool);

    const incoming = msg.stations ?? [];
    const changed  = [];
    for (const st of incoming) {
      const pcId = stationToPcId(st.station_id);
      if (!pcId) continue;
      const key = stationVisualKey(st);
      if (prevKeysRef.current[pcId] !== key) {
        prevKeysRef.current[pcId] = key;
        changed.push({ ...st, pc_id: pcId });
      }
    }
    if (changed.length > 0) {
      setStationsMap(prev => {
        const next = new Map(prev);
        for (const st of changed) next.set(st.pc_id, st);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/api/salle/ws`;
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(url);
      ws.onmessage = (e) => {
        try { handleMessage(JSON.parse(e.data)); } catch { /* ignore */ }
      };
      ws.onerror = () => setError("WebSocket : erreur de connexion");
      ws.onclose = () => {
        setError("WebSocket déconnecté — reconnexion…");
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, [handleMessage]);

  // 30 slots fixes — never_seen si pas encore reçu
  const pcs = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const id = i + 1;
    return stationsMap.get(id) ?? {
      pc_id: id,
      station_id: `PC-${String(id).padStart(5, "0")}`,
      _never_seen: true,
      connected: false,
      operator: null, scenario: null, alert: false,
      recording: { is_recording: false, failed: false, trigger: null, duration_s: 0 },
      upload: null, trackers: {}, grippers: { left: { connected: false }, right: { connected: false } }, cameras: [],
    };
  }), [stationsMap]);

  const stats = useMemo(() => pcs.reduce((acc, pc) => {
    const s = stationStatus(pc);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {}), [pcs]);

  const selectedPcData = selectedPc !== null ? pcs.find(p => p.pc_id === selectedPc) : null;

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
            Surveillance temps-réel · Kafka topic2 · WebSocket
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
          { label: "Actifs",          value: stats.active       ?? 0, color: "#22c55e" },
          { label: "Enregistrement",  value: stats.recording    ?? 0, color: "#a855f7" },
          { label: "Upload",          value: stats.uploading    ?? 0, color: "#f59e0b" },
          { label: "Déconnectés",     value: stats.disconnected ?? 0, color: "#f87171" },
          { label: "Inconnus",        value: stats.never_seen   ?? 0, color: "#374151" },
          { label: "Total postes",    value: 30,                      color: "#e2e8f0" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <span style={{ color, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</span>
            <span style={{ color: "#4b5563", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</span>
          </div>
        ))}
        <LastUpdateLabel lastUpdateRef={lastUpdateRef} />
      </div>

      {/* Zone principale */}
      <div style={{ position: "relative" }}>
        <div style={{
          display: "flex", gap: 24,
          transition: "margin-right 0.3s",
          marginRight: selectedPc ? 316 : 0,
        }}>
          {/* ── BLUEPRINT SALLE ─────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            border: "2px solid rgba(99,102,241,0.5)",
            borderRadius: 12,
            background: "rgba(6,12,30,0.95)",
            padding: 24,
            position: "relative",
            boxShadow: "0 0 40px rgba(99,102,241,0.1), inset 0 0 60px rgba(0,0,50,0.5)",
          }}>
            {/* Grid lines */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden",
              backgroundImage: `
                linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
              pointerEvents: "none",
            }} />

            <div style={{
              position: "absolute", top: -11, left: 20,
              background: "#020817", padding: "0 10px",
              color: "rgba(99,102,241,0.7)", fontSize: 9, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 2,
            }}>
              SALLE DE RÉCOLTE · PLAN DE SALLE
            </div>
            <div style={{
              position: "absolute", top: -11, right: 20,
              background: "#020817", padding: "0 10px",
              color: "rgba(99,102,241,0.4)", fontSize: 9,
            }}>
              30 POSTES · SCHÉMA v1
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{
                color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 2, marginBottom: 12,
              }}>
                POSTES D'ENREGISTREMENT
              </p>

              {rows.map((row, rowIdx) => {
                const isReversed = rowIdx === 2 || rowIdx === 4;
                return (
                  <div key={rowIdx} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 8, width: 52, flexShrink: 0 }}>
                        {isReversed ? "←" : "→"} R{rowIdx + 1}
                      </span>
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

            {loading && stationsMap.size === 0 && (
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

        {/* Panneau de détail */}
        {selectedPcData && (
          <PcDetailPanel pc={selectedPcData} onClose={() => setSelectedPc(null)} />
        )}
      </div>

      {/* ── SPOOL ─────────────────────────────────────────────────────────── */}
      <SpoolSection spool={spool} />
    </div>
  );
}
