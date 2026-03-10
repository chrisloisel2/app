import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#0d0e1a",
  bgSurface:   "#12141f",
  bgCard:      "#181a2e",
  bgCardAlt:   "#1c1e33",
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
  okBg:        "#0a2018",
  okBorder:    "#174830",
  warn:        "#f9a825",
  warnBg:      "#1e1800",
  warnBorder:  "#3d3000",
  error:       "#ff5555",
  errorBg:     "#1e0808",
  errorBorder: "#3d1010",
  grey:        "#4a5278",
  greyBg:      "#0e1020",
  greyBorder:  "#1e2240",
  rec:         "#ff3f3f",
};

const FG = { ok: "#22d47e", warn: "#f9a825", error: "#ff5555", grey: "#4a5278" };
const BG = { ok: "#0a2018", warn: "#1e1800", error: "#1e0808", grey: "#0e1020" };

const ALERT_TIMEOUT_S = 120;

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "station",  label: "Station",      w: "8rem",  align: "left"   },
  { key: "operator", label: "Opérateur",    w: "9rem",  align: "left"   },
  { key: "scenario", label: "Scénario",     w: "11rem", align: "left"   },
  { key: "cameras",  label: "Caméras",      w: "6rem",  align: "center" },
  { key: "pince_r",  label: "PinD",         w: "4rem",  align: "center" },
  { key: "pince_l",  label: "PinG",         w: "4rem",  align: "center" },
  { key: "trackers", label: "Trackers",     w: "10rem", align: "center" },
  { key: "integ",    label: "Intégrité",    w: "6rem",  align: "center" },
  { key: "rec",      label: "REC",          w: "5rem",  align: "center" },
  { key: "duration", label: "Durée",        w: "5rem",  align: "center" },
  { key: "ts",       label: "MAJ",          w: "6rem",  align: "center" },
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

function fmtAlertTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "14px 20px",
      minWidth: 130, position: "relative", overflow: "hidden", flex: "0 0 auto",
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
function Cell({ children, fg, bg, align = "center", style = {}, onClick, title }) {
  return (
    <td
      onClick={onClick}
      title={title}
      style={{
        color: fg || C.text,
        background: bg || "transparent",
        textAlign: align,
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 6px",
        borderRight: `1px solid ${C.border}`,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : undefined,
        ...style,
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
    : hasWarn
    ? `${latest.warnings.length} WARN`
    : "OK";
  return (
    <span
      onClick={onSelect}
      title="Voir les alertes d'intégrité"
      style={{
        color, fontWeight: 700, fontSize: 11, cursor: "pointer",
        borderBottom: `1px dashed ${color}`,
      }}
    >
      ⚠ {label}
    </span>
  );
}

// ── StationRow ────────────────────────────────────────────────────────────────
const StationRow = memo(function StationRow({ station, rowIndex, onSelectInteg }) {
  const bg  = rowIndex % 2 === 0 ? C.bgRow : C.bgRowAlt;
  const rc  = recordingColor(station.recording, station.connected);
  const recSym = station.recording?.is_recording ? "⏺ REC" : "⏹ OFF";
  const cameras = station.cameras || [];
  const matchedCams = cameras.filter(c => c.db_match).length;

  const handleSelectInteg = useCallback(() => onSelectInteg(station.station_id), [onSelectInteg, station.station_id]);

  return (
    <tr style={{ background: bg, opacity: station.connected ? 1 : 0.5 }}>
      <Cell fg={C.accent} bg={bg} align="left">{station.station_id}</Cell>
      <Cell fg={C.text}    bg={bg} align="left">{station.operator || "—"}</Cell>
      <Cell fg={C.textDim} bg={bg} align="left">{station.scenario || "—"}</Cell>

      <Cell bg={bg}>
        {cameras.length > 0
          ? <span style={{ color: matchedCams === cameras.length ? FG.ok : FG.warn }}>
              {matchedCams}/{cameras.length}
            </span>
          : <span style={{ color: C.grey }}>—</span>
        }
      </Cell>

      <Cell bg={station.grippers?.right?.connected ? BG.ok : BG.grey}>
        {connDot(station.grippers?.right?.connected)}
      </Cell>
      <Cell bg={station.grippers?.left?.connected ? BG.ok : BG.grey}>
        {connDot(station.grippers?.left?.connected)}
      </Cell>

      <Cell bg={bg}>
        <TrackersSummary trackers={station.trackers} connected={station.connected} />
      </Cell>

      <Cell bg={bg}>
        <IntegrityCellBadge alerts={station.integrity_alerts} onSelect={handleSelectInteg} />
      </Cell>

      <Cell fg={FG[rc]} bg={BG[rc]}>{recSym}</Cell>
      <Cell fg={FG[rc]} bg={BG[rc]}>{fmtDuration(station.recording?.duration_s)}</Cell>
      <Cell fg={C.textDim} bg={bg}>{formatTs(station.last_ts)}</Cell>
    </tr>
  );
});

// ── IntegrityAlertPanel ───────────────────────────────────────────────────────
function IntegrityAlertPanel({ stationId, alerts, onClose }) {
  if (!stationId) return null;
  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 360,
      background: "rgba(10,11,21,0.98)",
      border: `1px solid ${C.errorBorder}`,
      borderRadius: "8px 0 0 8px",
      boxShadow: "-4px 0 24px rgba(255,85,85,0.15)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <div>
          <span style={{ color: C.error, fontWeight: 700, fontSize: 13 }}>
            ⚠ Intégrité session
          </span>
          <span style={{ color: C.textDim, fontSize: 11, marginLeft: 8 }}>{stationId}</span>
        </div>
        <button onClick={onClose} style={{
          color: C.textDim, background: "none", border: "none",
          cursor: "pointer", fontSize: 16, padding: "0 4px",
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {!alerts || alerts.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 12, textAlign: "center", marginTop: 40 }}>
            Aucune alerte d'intégrité
          </p>
        ) : (
          alerts.map((a, i) => {
            const hasErrors = a.issues?.length > 0;
            const hasWarns  = a.warnings?.length > 0;
            const borderCol = hasErrors ? C.errorBorder : C.warnBorder;
            const headerCol = hasErrors ? C.error : C.warn;
            return (
              <div key={i} style={{
                background: hasErrors ? C.errorBg : C.warnBg,
                border: `1px solid ${borderCol}`,
                borderRadius: 6, padding: "10px 12px",
                marginBottom: 10,
              }}>
                {/* Alert header */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: headerCol, fontWeight: 700, fontSize: 11 }}>
                    {hasErrors ? "ERREUR" : "AVERTISSEMENT"}
                  </span>
                  <span style={{ color: C.textDim, fontSize: 10 }}>{fmtAlertTs(a.ts)}</span>
                </div>

                {/* Session info */}
                {a.session_id && (
                  <div style={{ color: C.textDim, fontSize: 10, marginBottom: 6 }}>
                    <span style={{ color: C.textMuted }}>Session : </span>
                    <span style={{ color: C.text }}>{a.session_id}</span>
                  </div>
                )}
                {(a.operator || a.scenario) && (
                  <div style={{ color: C.textDim, fontSize: 10, marginBottom: 6 }}>
                    {a.operator && <span style={{ marginRight: 8 }}>
                      <span style={{ color: C.textMuted }}>Op : </span>{a.operator}
                    </span>}
                    {a.scenario && <span>
                      <span style={{ color: C.textMuted }}>Scén : </span>{a.scenario}
                    </span>}
                  </div>
                )}

                {/* Cameras */}
                {(a.cameras_found?.length > 0 || a.cameras_missing_mp4?.length > 0 || a.cameras_missing_jsonl?.length > 0) && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Caméras</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {a.cameras_found?.map(cam => {
                        const missingMp4  = a.cameras_missing_mp4?.includes(cam);
                        const missingJsonl = a.cameras_missing_jsonl?.includes(cam);
                        const col = (missingMp4 || missingJsonl) ? C.error : C.ok;
                        return (
                          <span key={cam} style={{
                            color: col, fontSize: 10,
                            background: `${col}18`,
                            border: `1px solid ${col}44`,
                            borderRadius: 3, padding: "1px 5px",
                          }}>
                            {cam}
                            {missingMp4   && " ✗MP4"}
                            {missingJsonl && " ✗JSONL"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {a.issues?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Erreurs</div>
                    {a.issues.map((issue, j) => (
                      <div key={j} style={{
                        color: C.error, fontSize: 10,
                        padding: "2px 0",
                        borderLeft: `2px solid ${C.error}`,
                        paddingLeft: 6, marginBottom: 2,
                      }}>
                        {issue}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {a.warnings?.length > 0 && (
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Avertissements</div>
                    {a.warnings.map((w, j) => (
                      <div key={j} style={{
                        color: C.warn, fontSize: 10,
                        borderLeft: `2px solid ${C.warn}`,
                        paddingLeft: 6, marginBottom: 2,
                      }}>
                        {w}
                      </div>
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

// ── GlobalIntegrityBanner ─────────────────────────────────────────────────────
function GlobalIntegrityBanner({ stations, onSelect }) {
  // Collect the most recent error across all stations
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
      margin: "12px 24px 0",
      background: C.errorBg,
      border: `1px solid ${C.errorBorder}`,
      borderRadius: 6, padding: "10px 14px",
      flexShrink: 0,
    }}>
      <div style={{ color: C.error, fontWeight: 700, fontSize: 11, marginBottom: 6, letterSpacing: "0.06em" }}>
        ⚠ ALERTES D'INTÉGRITÉ SESSION ({alerts.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {alerts.map((a, i) => (
          <div
            key={i}
            onClick={() => onSelect(a.station_id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", padding: "3px 6px",
              borderRadius: 4,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,85,85,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 11, flexShrink: 0, minWidth: 60 }}>
              {a.station_id}
            </span>
            <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>
              {fmtAlertTs(a.ts)}
            </span>
            {a.issues?.length > 0 && (
              <span style={{ color: C.error, fontSize: 10 }}>
                {a.issues[0]}
                {a.issues.length > 1 && ` (+${a.issues.length - 1})`}
              </span>
            )}
            {a.issues?.length === 0 && a.warnings?.length > 0 && (
              <span style={{ color: C.warn, fontSize: 10 }}>
                {a.warnings[0]}
                {a.warnings.length > 1 && ` (+${a.warnings.length - 1})`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrchestrateurPage() {
  // Stations conservées entre les messages (Map station_id → station)
  const [stationsMap, setStationsMap] = useState(() => new Map());
  const [stats, setStats]             = useState({ total: 0, connected: 0, recording: 0, disconnected: 0 });
  const [clock, setClock]             = useState("");
  const [blink, setBlink]             = useState(true);
  const [kafkaStatus, setKafkaStatus] = useState("connecting");
  const [selectedInteg, setSelectedInteg] = useState(null); // station_id

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("fr-FR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Blink
  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 900);
    return () => clearInterval(id);
  }, []);

  // WebSocket — merge incoming stations, never erase existing ones
  const handleMessage = useCallback((msg) => {
    setKafkaStatus(msg.connected ? "connected" : "disconnected");

    if (msg.stats) setStats(msg.stats);

    const incoming = msg.stations ?? [];
    if (incoming.length > 0) {
      setStationsMap(prev => {
        const next = new Map(prev);
        for (const st of incoming) {
          next.set(st.station_id, st);
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
      ws.onerror = () => { setKafkaStatus("error"); };
      ws.onclose = () => {
        setKafkaStatus("disconnected");
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, [handleMessage]);

  const stations = useMemo(() => Array.from(stationsMap.values()), [stationsMap]);

  const handleSelectInteg = useCallback((stationId) => {
    setSelectedInteg(prev => prev === stationId ? null : stationId);
  }, []);

  const selectedStation = selectedInteg
    ? stations.find(s => s.station_id === selectedInteg)
    : null;

  const statusLabel = {
    connected:    `✓  [monitoring]  WebSocket`,
    disconnected: `—  Déconnecté`,
    error:        `⚠  Erreur`,
    connecting:   `… Connexion…`,
  }[kafkaStatus] ?? kafkaStatus;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Helvetica, sans-serif" }}>

      {/* Accent bar */}
      <div style={{ height: 3, background: C.accent, flexShrink: 0 }} />

      {/* Header */}
      <div style={{ background: C.bgHeader, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <span style={{ color: C.accent, fontWeight: 700, fontSize: 17, letterSpacing: "0.04em" }}>ORCHESTRATEUR</span>
          <span style={{ color: C.text,   fontWeight: 400, fontSize: 17, marginLeft: 6 }}>MONITOR</span>
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
            background: blink && kafkaStatus === "connected" ? C.ok : C.bgCard,
            transition: "background 0.2s",
          }} />
          <span style={{ color: C.textDim, fontSize: 12 }}>{statusLabel}</span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding: "20px 24px 0", display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <StatCard icon="▣" label="Stations"        value={stats.total}        accent={C.accent} />
        <StatCard icon="●" label="Connectées"       value={stats.connected}    accent={C.ok}     />
        <StatCard icon="⏺" label="Enregistrements" value={stats.recording}    accent={C.rec}    />
        <StatCard icon="○" label="Déconnectées"     value={stats.disconnected} accent={C.grey}   />
        <StatCard
          icon="⚠"
          label="Alertes intégrité"
          value={stations.filter(s => s.integrity_alerts?.length > 0).length}
          accent={stations.some(s => s.integrity_alerts?.some(a => a.issues?.length > 0)) ? C.error : C.warn}
        />
      </div>

      {/* Global integrity banner */}
      <GlobalIntegrityBanner stations={stations} onSelect={handleSelectInteg} />

      {/* Table */}
      <div style={{ padding: "18px 24px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
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
                    <td colSpan={COLUMNS.length} style={{
                      textAlign: "center", padding: "60px 0",
                    }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <span style={{ color: C.textMuted, fontSize: 13 }}>
                          {kafkaStatus === "connecting"
                            ? "Connexion au broker Kafka…"
                            : "En attente des premières stations…"}
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

      {/* Integrity detail panel */}
      <IntegrityAlertPanel
        stationId={selectedInteg}
        alerts={selectedStation?.integrity_alerts}
        onClose={() => setSelectedInteg(null)}
      />
    </div>
  );
}
