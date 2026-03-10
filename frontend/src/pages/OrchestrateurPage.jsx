import { useState, useEffect, useCallback, useMemo, memo } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#0d0e1a",
  bgSurface:   "#12141f",
  bgCard:      "#181a2e",
  bgHeader:    "#0a0b15",
  bgRow:       "#14162a",
  bgRowAlt:    "#111225",
  border:      "#252740",
  borderLight: "#2e3060",
  text:        "#d0d2e8",
  textDim:     "#6870a0",
  textMuted:   "#404468",
  accent:      "#7c6fff",
  ok:          "#22d47e",
  warn:        "#f9a825",
  error:       "#ff5555",
  grey:        "#4a5278",
  rec:         "#ff3f3f",
};

const FG = { ok: "#22d47e", warn: "#f9a825", error: "#ff5555", grey: "#4a5278" };
const BG = { ok: "#0a2018", warn: "#1e1800", error: "#1e0808", grey: "#0e1020" };

const ALERT_TIMEOUT_S = 120;

// ── Columns ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "station",  label: "Station",   w: "8rem",  align: "left"   },
  { key: "operator", label: "Opérateur", w: "9rem",  align: "left"   },
  { key: "scenario", label: "Scénario",  w: "11rem", align: "left"   },
  { key: "cameras",  label: "Caméras",   w: "6rem",  align: "center" },
  { key: "pince_r",  label: "PinD",      w: "4rem",  align: "center" },
  { key: "pince_l",  label: "PinG",      w: "4rem",  align: "center" },
  { key: "trackers", label: "Trackers",  w: "10rem", align: "center" },
  { key: "integ",    label: "Intégrité", w: "6rem",  align: "center" },
  { key: "rec",      label: "REC",       w: "5rem",  align: "center" },
  { key: "duration", label: "Durée",     w: "5rem",  align: "center" },
  { key: "ts",       label: "MAJ",       w: "6rem",  align: "center" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts || ts === 0) return "--:--:--";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR");
}
function fmtDuration(s) {
  if (!s || s === 0) return "—";
  return `${Number(s).toFixed(1)}s`;
}
function fmtAlertTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function connDot(connected) {
  return connected
    ? <span style={{ color: FG.ok }}>●</span>
    : <span style={{ color: FG.grey }}>○</span>;
}
function recordingColor(rec, connected) {
  if (!connected) return "grey";
  const now = Date.now() / 1000;
  if (rec.is_recording) {
    if (rec.last_start_ts > 0 && (now - rec.last_start_ts) > ALERT_TIMEOUT_S) return "warn";
    return "ok";
  }
  if (rec.last_activity_ts > 0 && (now - rec.last_activity_ts) > ALERT_TIMEOUT_S) return "warn";
  return "grey";
}

// ── useBlink ──────────────────────────────────────────────────────────────────
function useBlink(active, ms = 500) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!active) { setOn(true); return; }
    const id = setInterval(() => setOn(b => !b), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return on;
}

// ── AlertBanner ───────────────────────────────────────────────────────────────
// Bandeau rouge en haut de page quand des stations ont alert=true
function AlertBanner({ stations, onSelect }) {
  const alertStations = useMemo(
    () => stations.filter(s => s.alert),
    [stations],
  );
  const blink = useBlink(alertStations.length > 0, 600);

  if (alertStations.length === 0) return null;

  return (
    <div style={{
      background: blink ? "rgba(220,38,38,0.18)" : "rgba(80,10,10,0.7)",
      borderBottom: `2px solid ${blink ? C.error : "rgba(220,38,38,0.4)"}`,
      padding: "8px 24px",
      display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <span style={{ color: C.error, fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", flexShrink: 0 }}>
        🚨 ALERTE STATION
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {alertStations.map(s => (
          <button
            key={s.station_id}
            onClick={() => onSelect(s.station_id)}
            style={{
              background: "rgba(220,38,38,0.25)", border: `1px solid ${C.error}`,
              color: C.error, fontWeight: 700, fontSize: 11, borderRadius: 4,
              padding: "3px 10px", cursor: "pointer", fontFamily: "monospace",
            }}
          >
            ⚠ {s.station_id}
            {s.operator ? ` · ${s.operator}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, blink = false }) {
  const b = useBlink(blink, 700);
  return (
    <div style={{
      background: blink && b ? `${accent}22` : C.bgCard,
      border: `1px solid ${blink && b ? accent : C.border}`,
      borderRadius: 8, padding: "14px 20px",
      minWidth: 130, position: "relative", overflow: "hidden", flex: "0 0 auto",
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: accent, fontSize: 15 }}>{icon}</span>
        <span style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ color: accent, fontSize: 28, fontWeight: 700, lineHeight: 1, fontFamily: "monospace" }}>
        {value}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: accent }} />
    </div>
  );
}

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ children, fg, bg, align = "center", onClick, title }) {
  return (
    <td onClick={onClick} title={title} style={{
      color: fg || C.text, background: bg || "transparent",
      textAlign: align, fontFamily: "monospace", fontSize: 12, fontWeight: 600,
      padding: "6px 6px", borderRight: `1px solid ${C.border}`,
      whiteSpace: "nowrap", cursor: onClick ? "pointer" : undefined,
    }}>
      {children}
    </td>
  );
}

// ── TrackersSummary ───────────────────────────────────────────────────────────
const TrackersSummary = memo(function TrackersSummary({ trackers, connected }) {
  const list = Object.values(trackers || {});
  if (!connected || list.length === 0) return <span style={{ color: C.grey }}>—</span>;
  return (
    <span style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
      {list.map((t) => {
        const col = !t.tracking ? FG.warn : (t.battery !== undefined && t.battery < 0.05 ? FG.error : FG.ok);
        const title = [t.serial, t.tracking ? "tracking OK" : "tracking PERDU",
          t.battery !== undefined ? `bat ${Math.round(t.battery * 100)}%` : null,
        ].filter(Boolean).join(" · ");
        return (
          <span key={t.idx} title={title} style={{ color: col, fontSize: 11 }}>
            {t.tracking ? "●" : "▲"}T{t.idx}
          </span>
        );
      })}
    </span>
  );
});

// ── IntegrityCellBadge ────────────────────────────────────────────────────────
function IntegrityCellBadge({ alerts, onSelect }) {
  if (!alerts || alerts.length === 0) return <span style={{ color: C.grey }}>—</span>;
  const latest = alerts[0];
  const hasError = latest.issues?.length > 0;
  const hasWarn  = latest.warnings?.length > 0;
  const color = hasError ? C.error : hasWarn ? C.warn : C.ok;
  const label = hasError
    ? `${latest.issues.length} ERR`
    : hasWarn ? `${latest.warnings.length} WARN` : "OK";
  return (
    <span onClick={onSelect} title="Voir les alertes d'intégrité" style={{
      color, fontWeight: 700, fontSize: 11, cursor: "pointer",
      borderBottom: `1px dashed ${color}`,
    }}>
      ⚠ {label}
    </span>
  );
}

// ── StationRow ────────────────────────────────────────────────────────────────
const StationRow = memo(function StationRow({ station, rowIndex, onSelectInteg }) {
  const hasAlert = Boolean(station.alert);
  const blink    = useBlink(hasAlert, 500);

  const bg = hasAlert
    ? (blink ? "rgba(220,38,38,0.20)" : "rgba(50,8,8,0.75)")
    : rowIndex % 2 === 0 ? C.bgRow : C.bgRowAlt;

  const rc     = recordingColor(station.recording, station.connected);
  const recSym = station.recording?.is_recording ? "⏺ REC" : "⏹ OFF";
  const cameras = station.cameras || [];
  const matchedCams = cameras.filter(c => c.db_match).length;

  const handleSelectInteg = useCallback(
    () => onSelectInteg(station.station_id),
    [onSelectInteg, station.station_id],
  );

  return (
    <tr style={{
      background: bg,
      opacity: station.connected ? 1 : 0.45,
      boxShadow: hasAlert && blink ? `inset 0 0 0 1px ${C.error}` : undefined,
    }}>
      {/* Station */}
      <Cell fg={hasAlert ? C.error : C.accent} bg={bg} align="left">
        {hasAlert && <span style={{ marginRight: 4, fontSize: 11 }}>⚠</span>}
        {station.station_id}
      </Cell>

      {/* Opérateur */}
      <Cell fg={hasAlert ? "#fca5a5" : C.text} bg={bg} align="left">
        {station.operator || "—"}
      </Cell>

      {/* Scénario */}
      <Cell fg={hasAlert ? "#fca5a5" : C.textDim} bg={bg} align="left">
        {station.scenario || "—"}
      </Cell>

      {/* Caméras */}
      <Cell bg={bg}>
        {cameras.length > 0
          ? <span style={{ color: matchedCams === cameras.length ? FG.ok : FG.warn }}>
              {matchedCams}/{cameras.length}
            </span>
          : <span style={{ color: C.grey }}>—</span>
        }
      </Cell>

      {/* Grippers */}
      <Cell bg={station.grippers?.right?.connected ? BG.ok : BG.grey}>
        {connDot(station.grippers?.right?.connected)}
      </Cell>
      <Cell bg={station.grippers?.left?.connected ? BG.ok : BG.grey}>
        {connDot(station.grippers?.left?.connected)}
      </Cell>

      {/* Trackers */}
      <Cell bg={bg}>
        <TrackersSummary trackers={station.trackers} connected={station.connected} />
      </Cell>

      {/* Intégrité */}
      <Cell bg={bg}>
        <IntegrityCellBadge alerts={station.integrity_alerts} onSelect={handleSelectInteg} />
      </Cell>

      {/* REC / Durée / MAJ */}
      <Cell fg={FG[rc]} bg={BG[rc]}>{recSym}</Cell>
      <Cell fg={FG[rc]} bg={BG[rc]}>{fmtDuration(station.recording?.duration_s)}</Cell>
      <Cell fg={C.textDim} bg={bg}>{formatTs(station.last_ts)}</Cell>
    </tr>
  );
});

// ── IntegrityAlertPanel ───────────────────────────────────────────────────────
function IntegrityAlertPanel({ stationId, station, onClose }) {
  if (!stationId) return null;
  const alerts = station?.integrity_alerts ?? [];
  const hasStationAlert = Boolean(station?.alert);

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 380,
      background: "rgba(10,11,21,0.98)",
      border: `1px solid ${C.error}44`,
      borderRadius: "8px 0 0 8px",
      boxShadow: "-4px 0 30px rgba(255,85,85,0.12)",
      display: "flex", flexDirection: "column",
      zIndex: 100, fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
        background: hasStationAlert ? "rgba(220,38,38,0.08)" : undefined,
      }}>
        <div>
          <span style={{ color: C.error, fontWeight: 700, fontSize: 13 }}>
            {hasStationAlert ? "🚨 ALERTE ACTIVE" : "⚠ Intégrité session"}
          </span>
          <span style={{ color: C.textDim, fontSize: 11, marginLeft: 8 }}>{stationId}</span>
          {station?.operator && (
            <span style={{ color: C.textMuted, fontSize: 10, marginLeft: 8 }}>
              · {station.operator}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          color: C.textDim, background: "none", border: "none",
          cursor: "pointer", fontSize: 16, padding: "0 4px",
        }}>✕</button>
      </div>

      {/* Station alert active */}
      {hasStationAlert && (
        <div style={{
          background: "rgba(220,38,38,0.12)", borderBottom: `1px solid rgba(220,38,38,0.25)`,
          padding: "10px 16px", flexShrink: 0,
        }}>
          <div style={{ color: C.error, fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
            Station en alerte (station_alert actif)
          </div>
          <div style={{ color: "#fca5a5", fontSize: 10 }}>
            Scénario : {station?.scenario || "—"} · Opérateur : {station?.operator || "—"}
          </div>
        </div>
      )}

      {/* Integrity alerts body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {alerts.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 12, textAlign: "center", marginTop: 40 }}>
            Aucune alerte d'intégrité de session
          </p>
        ) : (
          alerts.map((a, i) => {
            const hasErrors = a.issues?.length > 0;
            const hasWarns  = a.warnings?.length > 0;
            const col       = hasErrors ? C.error : C.warn;
            return (
              <div key={i} style={{
                background: hasErrors ? "#1e080888" : "#1e180088",
                border: `1px solid ${col}44`,
                borderLeft: `3px solid ${col}`,
                borderRadius: 6, padding: "10px 12px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: col, fontWeight: 700, fontSize: 11 }}>
                    {hasErrors ? "ERREUR" : "AVERTISSEMENT"}
                  </span>
                  <span style={{ color: C.textDim, fontSize: 10 }}>{fmtAlertTs(a.ts)}</span>
                </div>

                {a.session_id && (
                  <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 4 }}>
                    Session : <span style={{ color: C.text }}>{a.session_id}</span>
                  </div>
                )}

                {/* Cameras */}
                {a.cameras_found?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Caméras</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {a.cameras_found.map(cam => {
                        const mp4  = a.cameras_missing_mp4?.includes(cam);
                        const jsonl = a.cameras_missing_jsonl?.includes(cam);
                        const c = (mp4 || jsonl) ? C.error : C.ok;
                        return (
                          <span key={cam} style={{
                            color: c, fontSize: 10,
                            background: `${c}18`, border: `1px solid ${c}44`,
                            borderRadius: 3, padding: "1px 5px",
                          }}>
                            {cam}{mp4 && " ✗MP4"}{jsonl && " ✗JSONL"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {a.issues?.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    {a.issues.map((issue, j) => (
                      <div key={j} style={{
                        color: C.error, fontSize: 10,
                        borderLeft: `2px solid ${C.error}`,
                        paddingLeft: 6, marginBottom: 2,
                      }}>{issue}</div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {a.warnings?.length > 0 && (
                  <div>
                    {a.warnings.map((w, j) => (
                      <div key={j} style={{
                        color: C.warn, fontSize: 10,
                        borderLeft: `2px solid ${C.warn}`,
                        paddingLeft: 6, marginBottom: 2,
                      }}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── IntegrityBanner ───────────────────────────────────────────────────────────
// Bandeau intégrité session (sous l'alerte station)
function IntegrityBanner({ stations, onSelect }) {
  const alerts = useMemo(() => {
    const out = [];
    for (const st of stations) {
      for (const a of (st.integrity_alerts || [])) {
        if (a.issues?.length > 0 || a.warnings?.length > 0) {
          out.push({ ...a, station_id: st.station_id });
        }
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, 5);
  }, [stations]);

  if (alerts.length === 0) return null;

  return (
    <div style={{
      margin: "10px 24px 0",
      background: "#1e080888",
      border: `1px solid ${C.error}33`,
      borderLeft: `3px solid ${C.error}`,
      borderRadius: 6, padding: "8px 14px", flexShrink: 0,
    }}>
      <div style={{ color: C.error, fontWeight: 700, fontSize: 10, marginBottom: 5, letterSpacing: "0.06em" }}>
        INTÉGRITÉ SESSION — {alerts.length} alerte{alerts.length > 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {alerts.map((a, i) => (
          <div key={i} onClick={() => onSelect(a.station_id)} style={{
            display: "flex", alignItems: "baseline", gap: 8,
            cursor: "pointer", padding: "2px 4px", borderRadius: 3,
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,85,85,0.07)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 11, flexShrink: 0, minWidth: 56 }}>
              {a.station_id}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10, flexShrink: 0 }}>{fmtAlertTs(a.ts)}</span>
            <span style={{ color: a.issues?.length > 0 ? C.error : C.warn, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.issues?.length > 0
                ? `${a.issues[0]}${a.issues.length > 1 ? ` (+${a.issues.length - 1})` : ""}`
                : `${a.warnings[0]}${a.warnings.length > 1 ? ` (+${a.warnings.length - 1})` : ""}`
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrchestrateurPage() {
  const [stationsMap, setStationsMap]   = useState(() => new Map());
  const [stats, setStats]               = useState({ total: 0, connected: 0, recording: 0, disconnected: 0 });
  const [clock, setClock]               = useState("");
  const [kafkaStatus, setKafkaStatus]   = useState("connecting");
  const [selectedInteg, setSelectedInteg] = useState(null);
  const headerBlink = useBlink(kafkaStatus === "connected", 900);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("fr-FR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // WebSocket
  const handleMessage = useCallback((msg) => {
    setKafkaStatus(msg.connected ? "connected" : "disconnected");
    if (msg.stats) setStats(msg.stats);
    const incoming = msg.stations ?? [];
    if (incoming.length > 0) {
      setStationsMap(prev => {
        const next = new Map(prev);
        for (const st of incoming) next.set(st.station_id, st);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/api/salle/ws`;
    let ws, reconnectTimer;
    const connect = () => {
      ws = new WebSocket(url);
      ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch { /**/ } };
      ws.onerror   = () => setKafkaStatus("error");
      ws.onclose   = () => { setKafkaStatus("disconnected"); reconnectTimer = setTimeout(connect, 2000); };
    };
    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, [handleMessage]);

  // Stations triées : alertes actives en premier
  const stations = useMemo(() => {
    const arr = Array.from(stationsMap.values());
    return arr.sort((a, b) => {
      if (a.alert && !b.alert) return -1;
      if (!a.alert && b.alert) return 1;
      const aInteg = a.integrity_alerts?.length > 0 ? 1 : 0;
      const bInteg = b.integrity_alerts?.length > 0 ? 1 : 0;
      return bInteg - aInteg;
    });
  }, [stationsMap]);

  const handleSelectInteg = useCallback((sid) => {
    setSelectedInteg(prev => prev === sid ? null : sid);
  }, []);

  const selectedStation = selectedInteg ? stationsMap.get(selectedInteg) : null;

  const activeAlertCount  = stations.filter(s => s.alert).length;
  const integAlertCount   = stations.filter(s => s.integrity_alerts?.length > 0).length;
  const hasAnyError       = stations.some(s => s.alert || s.integrity_alerts?.some(a => a.issues?.length > 0));

  const statusLabel = {
    connected:    `✓  WebSocket actif`,
    disconnected: `—  Déconnecté`,
    error:        `⚠  Erreur`,
    connecting:   `… Connexion…`,
  }[kafkaStatus] ?? kafkaStatus;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Helvetica, sans-serif" }}>

      {/* Accent bar — rouge si alerte, violet sinon */}
      <div style={{
        height: 3, flexShrink: 0,
        background: hasAnyError ? C.error : C.accent,
        transition: "background 0.4s",
      }} />

      {/* Header */}
      <div style={{ background: C.bgHeader, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: hasAnyError ? C.error : C.accent, fontWeight: 700, fontSize: 17, letterSpacing: "0.04em", transition: "color 0.3s" }}>
            ORCHESTRATEUR
          </span>
          <span style={{ color: C.text, fontWeight: 400, fontSize: 17, marginLeft: 6 }}>MONITOR</span>
          <div style={{ width: 1, height: 28, background: C.border, margin: "0 20px" }} />
          <span style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14 }}>{clock}</span>
        </div>

        <div style={{
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 4, padding: "6px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: headerBlink && kafkaStatus === "connected" ? C.ok : C.bgCard,
            transition: "background 0.2s",
          }} />
          <span style={{ color: C.textDim, fontSize: 12 }}>{statusLabel}</span>
        </div>
      </div>

      {/* Bandeau alerte station (clignotant) */}
      <AlertBanner stations={stations} onSelect={handleSelectInteg} />

      {/* Stats */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <StatCard icon="▣" label="Stations"        value={stats.total}        accent={C.accent} />
        <StatCard icon="●" label="Connectées"       value={stats.connected}    accent={C.ok}     />
        <StatCard icon="⏺" label="Enregistrements" value={stats.recording}    accent={C.rec}    />
        <StatCard icon="○" label="Déconnectées"     value={stats.disconnected} accent={C.grey}   />
        <StatCard
          icon="🚨" label="Alertes station"
          value={activeAlertCount}
          accent={C.error}
          blink={activeAlertCount > 0}
        />
        <StatCard
          icon="⚠" label="Intégrité session"
          value={integAlertCount}
          accent={integAlertCount > 0 ? C.warn : C.grey}
        />
      </div>

      {/* Bandeau intégrité session */}
      <IntegrityBanner stations={stations} onSelect={handleSelectInteg} />

      {/* Table */}
      <div style={{ padding: "14px 24px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Stations en temps réel</span>
          <span style={{ color: C.textDim, fontSize: 11 }}>{stations.length} station(s)</span>
        </div>

        <div style={{
          flex: 1, border: `1px solid ${C.border}`, borderRadius: 4,
          background: C.bgSurface, display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
        }}>
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {COLUMNS.map(col => <col key={col.key} style={{ width: col.w }} />)}
              </colgroup>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: C.bgHeader }}>
                  {COLUMNS.map(col => (
                    <th key={col.key} style={{
                      color: C.textDim, fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: "center", padding: "8px 4px",
                      borderRight: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.borderLight}`,
                      whiteSpace: "nowrap",
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stations.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ textAlign: "center", padding: "60px 0" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <span style={{ color: C.textMuted, fontSize: 13 }}>
                          {kafkaStatus === "connecting" ? "Connexion au broker Kafka…" : "En attente des premières stations…"}
                        </span>
                        <span style={{ color: C.textMuted, fontSize: 10 }}>
                          Les données s'afficheront dès réception du premier événement
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stations.map((st, i) => (
                    <StationRow
                      key={st.station_id}
                      station={st}
                      rowIndex={i}
                      onSelectInteg={handleSelectInteg}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panneau de détail intégrité */}
      <IntegrityAlertPanel
        stationId={selectedInteg}
        station={selectedStation}
        onClose={() => setSelectedInteg(null)}
      />
    </div>
  );
}
