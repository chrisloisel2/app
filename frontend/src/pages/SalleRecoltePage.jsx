import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";

// ── Couleurs de statut ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  active:       { ring: "#22c55e", glow: "rgba(34,197,94,0.35)",  label: "#22c55e" },
  recording:    { ring: "#a855f7", glow: "rgba(168,85,247,0.35)", label: "#a855f7" },
  uploading:    { ring: "#f59e0b", glow: "rgba(245,158,11,0.35)", label: "#f59e0b" },
  queued:       { ring: "#6366f1", glow: "rgba(99,102,241,0.35)", label: "#6366f1" },
  disconnected: { ring: "#6b7280", glow: "rgba(107,114,128,0.15)", label: "#9ca3af" },
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
  const neverSeen   = pc._never_seen;

  const [alertBlink, setAlertBlink] = useState(true);
  useEffect(() => {
    if (!hasAlert) return;
    const id = setInterval(() => setAlertBlink(b => !b), 500);
    return () => clearInterval(id);
  }, [hasAlert]);

  const borderColor = hasAlert ? (alertBlink ? "#ef4444" : "#7f1d1d") : isRecording ? "#a855f7" : c.ring;
  const glowColor   = hasAlert
    ? (alertBlink ? "rgba(239,68,68,0.6)" : "rgba(239,68,68,0.05)")
    : isRecording ? "rgba(168,85,247,0.4)" : c.glow;

  // cameras
  const cameras = pc.cameras ?? [];
  // grippers / pinces
  const gripLeft  = pc.grippers?.left;
  const gripRight = pc.grippers?.right;
  const hasGrippers = gripLeft || gripRight;
  // trackers
  const trackers = pc.trackers ? Object.values(pc.trackers) : [];
  // upload
  const upload = pc.upload;
  // device faults actifs
  const deviceFaults = pc.device_faults ?? [];
  const faultsByKey = Object.fromEntries(deviceFaults.map(f => [`${f.device}/${f.device_id}`, f]));

  // ── helpers inline ────────────────────────────────────────────────────────
  const SectionLabel = ({ children }) => (
    <span style={{ color: "rgba(99,102,241,0.55)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 3 }}>
      {children}
    </span>
  );

  return (
    <div
      onClick={handleClick}
      style={{
        border: `1.5px solid ${selected ? "#93c5fd" : borderColor}`,
        boxShadow: selected
          ? `0 0 0 2px #3b82f6, 0 0 14px ${glowColor}`
          : `0 0 6px ${glowColor}`,
        background: hasAlert
          ? (alertBlink ? "rgba(60,10,10,0.97)" : "rgba(15,23,42,0.9)")
          : isRecording ? "rgba(30,10,45,0.95)"
          : neverSeen  ? "rgba(10,12,20,0.7)"
          : "rgba(15,23,42,0.92)",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        borderRadius: 7,
        // ── LANDSCAPE ──
        display: "flex",
        flexDirection: "row",
        width: 360,
        height: 110,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* ════ COLONNE GAUCHE : identité ════ */}
      <div style={{
        width: 120,
        flexShrink: 0,
        borderRight: `1px solid ${hasAlert ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.12)"}`,
        padding: "7px 9px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: hasAlert
          ? (alertBlink ? "rgba(80,5,5,0.5)" : "rgba(20,5,5,0.3)")
          : isRecording ? "rgba(50,0,70,0.4)" : "rgba(0,0,0,0.25)",
      }}>
        {/* ID + dot */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: hasAlert ? "#f87171" : c.label, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, fontFamily: "monospace" }}>
            PC-{String(pcId).padStart(5, "0")}
          </span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: borderColor, boxShadow: `0 0 5px ${glowColor}`, flexShrink: 0 }} />
        </div>

        {/* Badges statut */}
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {isRecording && <span style={{ background: "#7c3aed", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 2, padding: "1px 4px" }}>REC</span>}
          {hasAlert    && <span style={{ background: "#dc2626", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 2, padding: "1px 4px" }}>⚠</span>}
          {upload?.status === "sending" && !isRecording && <span style={{ background: "#f59e0b", color: "#000", fontSize: 8, fontWeight: 700, borderRadius: 2, padding: "1px 4px" }}>⬆</span>}
          {upload?.status === "queued"  && !isRecording && <span style={{ background: "#6366f1", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 2, padding: "1px 4px" }}>Q</span>}
        </div>

        {/* Opérateur */}
        {!neverSeen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{
              color: operator ? (hasAlert ? "#fca5a5" : isRecording ? "#d8b4fe" : "#94a3b8") : "#2d3748",
              fontSize: 9, fontWeight: operator ? 600 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {operator ? `👤 ${operator}` : "—"}
            </span>
            {pc.scenario && (
              <span style={{ color: "#334155", fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pc.scenario}
              </span>
            )}
          </div>
        )}

        {/* Heure MAJ */}
        {!neverSeen && pc.last_ts && (
          <span style={{ color: "#1e293b", fontSize: 7, fontFamily: "monospace" }}>
            {new Date(pc.last_ts * 1000).toLocaleTimeString("fr-FR")}
          </span>
        )}

        {neverSeen && (
          <span style={{ color: "#1f2937", fontSize: 9, textAlign: "center" }}>non vu</span>
        )}
      </div>

      {/* ════ COLONNE DROITE : périphériques ════ */}
      {!neverSeen && (
        <div style={{
          flex: 1,
          padding: "7px 9px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          overflow: "hidden",
        }}>

          {/* ── Pannes actives ── */}
          {deviceFaults.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 4, padding: "3px 6px",
              display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center",
            }}>
              <span style={{ color: "#ef4444", fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, flexShrink: 0 }}>⚠</span>
              {deviceFaults.map((f, i) => (
                <span key={i} title={f.detail} style={{ color: "#f87171", fontSize: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {f.device === "camera" ? "📷" : f.device === "gripper" ? "🤏" : "◎"}{f.device_id} <span style={{ color: "#7f1d1d" }}>{f.fault}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── Ligne du milieu : Caméras + Pinces ── */}
          <div style={{ display: "flex", gap: 10, flex: 1, alignItems: "flex-start" }}>

            {/* Caméras */}
            <div style={{ flex: 1 }}>
              <SectionLabel>Caméras</SectionLabel>
              {cameras.length === 0 ? (
                <span style={{ color: "#1f2937", fontSize: 8 }}>aucune</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {cameras.map((cam, i) => {
                    const pos = String(cam.position ?? i);
                    const fault = faultsByKey[`camera/${pos}`];
                    const ok = cam.db_match && !fault;
                    return (
                      <div key={i} title={fault?.detail ?? ""} style={{
                        display: "flex", alignItems: "center", gap: 2,
                        background: fault ? "rgba(239,68,68,0.12)" : ok ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                        border: `1px solid ${fault ? "rgba(239,68,68,0.4)" : ok ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                        borderRadius: 3, padding: "2px 5px",
                      }}>
                        <span style={{ fontSize: 9 }}>📷</span>
                        <span style={{ color: fault ? "#f87171" : ok ? "#22c55e" : "#f59e0b", fontSize: 9, fontWeight: 700 }}>{pos}</span>
                        <span style={{ color: fault ? "#ef4444" : ok ? "#166534" : "#92400e", fontSize: 8 }}>{fault ? fault.fault.replace("_", " ") : ok ? "OK" : "?"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pinces */}
            <div style={{ flex: 1 }}>
              <SectionLabel>Pinces</SectionLabel>
              {!hasGrippers ? (
                <span style={{ color: "#1f2937", fontSize: 8 }}>aucune</span>
              ) : (
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { side: "G", g: gripLeft,  faultId: "left"  },
                    { side: "D", g: gripRight, faultId: "right" },
                  ].map(({ side, g, faultId }) => {
                    const fault = faultsByKey[`gripper/${faultId}`];
                    const conn  = g?.connected && !fault;
                    return (
                      <div key={side} title={fault?.detail ?? ""} style={{
                        display: "flex", alignItems: "center", gap: 3,
                        background: fault ? "rgba(239,68,68,0.12)" : conn ? "rgba(34,197,94,0.08)" : "rgba(107,114,128,0.06)",
                        border: `1px solid ${fault ? "rgba(239,68,68,0.4)" : conn ? "rgba(34,197,94,0.3)" : "rgba(107,114,128,0.18)"}`,
                        borderRadius: 3, padding: "2px 6px", flex: 1,
                      }}>
                        <span style={{ fontSize: 11 }}>🤏</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: fault ? "#f87171" : conn ? "#22c55e" : "#374151", fontSize: 9, fontWeight: 700 }}>{side}</span>
                          <span style={{ color: fault ? "#ef4444" : conn ? "#166534" : "#374151", fontSize: 8 }}>
                            {fault ? fault.fault.replace("_", " ") : conn ? (g.port ?? "OK") : "off"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Trackers + Upload ── */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Trackers */}
            {(trackers.length > 0 || deviceFaults.some(f => f.device === "tracker")) && (
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <SectionLabel>Trackers&nbsp;</SectionLabel>
                {trackers.map(t => {
                  const fault = faultsByKey[`tracker/T${t.idx}`] ?? faultsByKey[`tracker/${t.idx}`];
                  const ok = t.tracking && !fault;
                  return (
                    <div key={t.idx} title={fault?.detail ?? ""} style={{
                      display: "flex", alignItems: "center", gap: 2,
                      background: fault ? "rgba(239,68,68,0.12)" : ok ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                      border: `1px solid ${fault ? "rgba(239,68,68,0.4)" : ok ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.35)"}`,
                      borderRadius: 3, padding: "2px 5px",
                    }}>
                      <span style={{ color: fault ? "#f87171" : ok ? "#22c55e" : "#f59e0b", fontSize: 9, fontWeight: 700 }}>T{t.idx}</span>
                      <span style={{ color: fault ? "#ef4444" : ok ? "#166534" : "#92400e", fontSize: 8 }}>{fault ? fault.fault.slice(0, 8) : ok ? "●" : "▲"}</span>
                    </div>
                  );
                })}
                {deviceFaults.filter(f => f.device === "tracker" && !trackers.find(t => `T${t.idx}` === f.device_id || String(t.idx) === f.device_id)).map((f, i) => (
                  <div key={`df-${i}`} title={f.detail} style={{
                    display: "flex", alignItems: "center", gap: 2,
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: 3, padding: "2px 5px",
                  }}>
                    <span style={{ color: "#f87171", fontSize: 9, fontWeight: 700 }}>{f.device_id}</span>
                    <span style={{ color: "#ef4444", fontSize: 8 }}>{f.fault.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress */}
            {upload?.status === "sending" && upload.progress_pct != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 2, height: 4 }}>
                  <div style={{ width: `${Math.min(100, upload.progress_pct)}%`, height: "100%", background: "#f59e0b", borderRadius: 2, transition: "width 0.4s" }} />
                </div>
                <span style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{upload.progress_pct}%</span>
              </div>
            )}
          </div>
        </div>
      )}
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
    { color: "#6b7280", label: "Déconnecté"     },
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

function SpoolProgressBar({ pct, color = "#22d3ee" }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 3, flex: 1 }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: "100%", background: color, borderRadius: 3,
        transition: "width 0.4s", boxShadow: `0 0 4px ${color}66`,
      }} />
    </div>
  );
}

function SpoolDiskBar({ label, d }) {
  if (!d) return null;
  const pct = d.used_pct ?? 0;
  const color = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22d3ee";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
        <span style={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(1)}%</span>
      </div>
      <SpoolProgressBar pct={pct} color={color} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#334155" }}>
        <span>{d.used_mb >= 1000 ? (d.used_mb / 1024).toFixed(1) + " GB" : d.used_mb + " MB"} utilisés</span>
        <span>{d.free_mb >= 1000 ? (d.free_mb / 1024).toFixed(1) + " GB" : d.free_mb + " MB"} libres</span>
      </div>
    </div>
  );
}

function SpoolSection({ spool }) {
  if (!spool) return null;

  // Détecte le format — nouveau (spool_status) ou ancien
  const isNew = spool.source === "spool_status";

  if (!isNew) {
    // Ancien format minimaliste
    return (
      <div style={{
        marginTop: 20, border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8,
        background: "rgba(6,12,30,0.95)", padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <span style={{ color: spool.consumer_ok ? "#22c55e" : "#ef4444", fontSize: 10, fontWeight: 700 }}>
          {spool.consumer_ok ? "● SPOOL ACTIF" : "○ SPOOL INACTIF"}
        </span>
        <span style={{ color: "#64748b", fontSize: 10 }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>{spool.processed_total}</span> traitées ·{" "}
          <span style={{ color: spool.failed_total > 0 ? "#ef4444" : "#475569", fontWeight: 700 }}>{spool.failed_total}</span> échecs
        </span>
      </div>
    );
  }

  // ── Nouveau format spool_status ──────────────────────────────────────────────
  const { queue, current_transfer, stats, disk, recent_failed, recent_done, config, uptime_s } = spool;
  const ct = current_transfer;

  function fmtUptime(s) {
    if (!s) return "—";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return iso; }
  }
  function shortId(id) { return id ? String(id).slice(-8) : "—"; }

  return (
    <div style={{
      marginTop: 20,
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: 10,
      background: "rgba(6,12,30,0.97)",
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px",
        background: "rgba(99,102,241,0.06)",
        borderBottom: "1px solid rgba(99,102,241,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#22c55e", boxShadow: "0 0 5px #22c55e88",
          }} />
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            SPOOL ACTIF
          </span>
        </div>
        <span style={{ color: "#1e3a5f", fontSize: 9 }}>|</span>
        <span style={{ color: "#334155", fontSize: 9 }}>uptime {fmtUptime(uptime_s)}</span>
        {config && (
          <>
            <span style={{ color: "#1e3a5f", fontSize: 9 }}>|</span>
            <span style={{ color: "#334155", fontSize: 9 }}>
              {config.workers}w · retry×{config.max_retries} · NAS {config.nas_host}:{config.nas_port}
            </span>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>

        {/* ── Colonne 1 : Stats ── */}
        <div style={{ padding: "14px 16px", borderRight: "1px solid rgba(99,102,241,0.1)" }}>
          <div style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            Statistiques
          </div>
          {stats && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Traités aujourd'hui", value: stats.processed_today,  color: "#22c55e" },
                { label: "Transférés NAS",       value: stats.forwarded_to_nas, color: "#22d3ee" },
                { label: "Jobs total",            value: stats.total_jobs,       color: "#94a3b8" },
                { label: "Terminés",              value: stats.done,             color: "#22c55e" },
                { label: "En cours",              value: stats.processing,       color: "#f59e0b" },
                { label: "Échecs total",          value: stats.failed_total,     color: stats.failed_total > 0 ? "#ef4444" : "#475569" },
                { label: "Taux d'échec",          value: stats.fail_pct != null ? stats.fail_pct.toFixed(1) + "%" : "—", color: stats.fail_pct > 5 ? "#ef4444" : "#475569" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                  <span style={{ color: "#334155" }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{value ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Colonne 2 : Transfert en cours + File ── */}
        <div style={{ padding: "14px 16px", borderRight: "1px solid rgba(99,102,241,0.1)" }}>
          {/* Transfert actif */}
          <div style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            Transfert en cours
          </div>
          {ct ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
                <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                  PC-{String(ct.from_pc).padStart(2, "0")} · {shortId(ct.session_id)}
                </span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{ct.speed_mbps?.toFixed(1)} Mb/s</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SpoolProgressBar pct={ct.progress_pct ?? 0} color="#f59e0b" />
                <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {ct.progress_pct ?? 0}%
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: "#1e293b", fontSize: 10, marginBottom: 14 }}>Aucun transfert actif</div>
          )}

          {/* File d'attente */}
          <div style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            File ({queue?.count ?? 0} · {queue?.total_mb ? (queue.total_mb / 1024).toFixed(2) + " GB" : "0 MB"})
          </div>
          {queue?.entries?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {queue.entries.slice(0, 6).map((e, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "3px 6px",
                  background: "rgba(255,255,255,0.02)", borderRadius: 3, fontSize: 9,
                }}>
                  <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>
                    PC-{String(e.pc_id).padStart(2, "0")}
                  </span>
                  <span style={{ color: "#334155", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shortId(e.session_id)}
                  </span>
                  <span style={{ color: "#475569", flexShrink: 0 }}>{e.size_mb?.toFixed(0)} MB</span>
                  <span style={{ color: "#1e293b", flexShrink: 0 }}>{fmtTime(e.received_at)}</span>
                </div>
              ))}
              {queue.entries.length > 6 && (
                <div style={{ color: "#334155", fontSize: 9, paddingLeft: 6 }}>+{queue.entries.length - 6} de plus…</div>
              )}
            </div>
          ) : (
            <div style={{ color: "#1e293b", fontSize: 10 }}>File vide</div>
          )}
        </div>

        {/* ── Colonne 3 : Disques + Récents ── */}
        <div style={{ padding: "14px 16px" }}>
          {/* Disques */}
          <div style={{ color: "rgba(99,102,241,0.5)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            Stockage
          </div>
          {disk && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <SpoolDiskBar label="Inbox"      d={disk.inbox} />
              <SpoolDiskBar label="Spool"      d={disk.spool} />
              <SpoolDiskBar label="Quarantine" d={disk.quarantine} />
            </div>
          )}

          {/* Échecs récents */}
          {recent_failed?.length > 0 && (
            <>
              <div style={{ color: "rgba(239,68,68,0.5)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                Échecs récents
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {recent_failed.slice(0, 3).map((f, i) => (
                  <div key={i} style={{
                    background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)",
                    borderRadius: 3, padding: "4px 7px", fontSize: 9,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>
                        PC-{String(f.sender).padStart(2, "0")} · {shortId(f.job_id)}
                      </span>
                      <span style={{ color: "#475569" }}>×{f.attempts}</span>
                    </div>
                    <div style={{ color: "#7f1d1d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.error}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Footer : terminés récents ── */}
      {recent_done?.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(99,102,241,0.08)", padding: "8px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "rgba(99,102,241,0.4)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0 }}>
              Récents
            </span>
            {recent_done.slice(0, 8).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                <span style={{ color: "#334155", fontFamily: "monospace" }}>
                  PC-{String(d.sender).padStart(2, "0")}
                </span>
                <span style={{ color: "#1e293b" }}>{d.size_mb?.toFixed(0)} MB</span>
                <span style={{ color: "#0f172a" }}>{fmtTime(d.completed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const [selectedPc, setSelectedPc]   = useState(null);

  const prevMetaRef  = useRef(null);
  const lastUpdateRef = useRef(null);

  const handlePcClick = useCallback((pcId) => {
    setSelectedPc(prev => prev === pcId ? null : pcId);
  }, []);

  const handleMessage = useCallback((msg) => {
    setLoading(false);

    lastUpdateRef.current = msg.last_update;
    const metaKey = `${msg.connected}|${(msg.errors ?? []).length}`;
    if (metaKey !== prevMetaRef.current) {
      prevMetaRef.current = metaKey;
      setMeta({ connected: msg.connected, errors: msg.errors ?? [] });
    }

    if (msg.spool !== undefined) setSpool(msg.spool);

    const incoming = msg.stations ?? [];
    if (incoming.length > 0) {
      setStationsMap(prev => {
        const next = new Map(prev);
        for (const st of incoming) {
          const pcId = stationToPcId(st.station_id);
          if (pcId) next.set(pcId, { ...st, pc_id: pcId });
        }
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
      ws.onerror = () => {};
      ws.onclose = () => {
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
            Surveillance temps-réel · Kafka monitoring · WebSocket
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
          { label: "Déconnectés",     value: stats.disconnected ?? 0, color: "#9ca3af" },
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
                  <div key={rowIdx} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
                      {/* Label rangée vertical */}
                      <div style={{
                        color: "rgba(99,102,241,0.35)", fontSize: 8, width: 22, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        writingMode: "vertical-rl", letterSpacing: 2,
                      }}>
                        {isReversed ? "←" : "→"} R{rowIdx + 1}
                      </div>
                      {/* Grille 2 colonnes de cartes landscape */}
                      <div style={{
                        flex: 1,
                        background: "rgba(99,102,241,0.025)",
                        border: "1px solid rgba(99,102,241,0.08)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                        gap: 8,
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
