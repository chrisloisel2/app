import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

// ── Palette (matches tkinter app) ──────────────────────────────────────────
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
  accentGlow:  "#5046d6",
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
  recDim:      "#3a1a1a",
};

const FG = { green: C.ok, orange: C.warn, red: C.error, grey: C.grey };
const BG = { green: C.okBg, orange: C.warnBg, red: C.errorBg, grey: C.greyBg };

const ALERT_TIMEOUT_S = 120;

// ── Column definitions ──────────────────────────────────────────────────────
const COLUMNS = [
  { key: "id",       label: "ID",        w: "7rem",  align: "center" },
  { key: "operator", label: "Opérateur", w: "9rem",  align: "left"   },
  { key: "scenario", label: "Scénario",  w: "11rem", align: "left"   },
  { key: "tr_state", label: "Tracker D", w: "8rem",  align: "center" },
  { key: "tr_value", label: "Val",       w: "4.5rem",align: "center" },
  { key: "tl_state", label: "Tracker G", w: "8rem",  align: "center" },
  { key: "tl_value", label: "Val",       w: "4.5rem",align: "center" },
  { key: "th_state", label: "Tête",      w: "8rem",  align: "center" },
  { key: "th_value", label: "Val",       w: "4.5rem",align: "center" },
  { key: "pd",       label: "PinD",      w: "3.5rem",align: "center" },
  { key: "pg",       label: "PinG",      w: "3.5rem",align: "center" },
  { key: "c1",       label: "C1",        w: "3rem",  align: "center" },
  { key: "c2",       label: "C2",        w: "3rem",  align: "center" },
  { key: "c3",       label: "C3",        w: "3rem",  align: "center" },
  { key: "rec",      label: "REC",       w: "6rem",  align: "center" },
  { key: "duration", label: "Durée",     w: "5rem",  align: "center" },
  { key: "ts",       label: "MAJ",       w: "6rem",  align: "center" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function trackerColor(tracker, connected) {
  if (!connected || tracker.state === "DISCONNECTED") return "grey";
  if (tracker.state === "ERROR") return "red";
  if (tracker.state === "WARN")  return "orange";
  if (tracker.state === "OK")    return "green";
  return "grey";
}

function connColor(connected, indConnected) {
  if (!indConnected) return "grey";
  return connected ? "green" : "red";
}

function recordingColor(rec, connected) {
  if (!connected) return "grey";
  const now = Date.now() / 1000;
  if (rec.is_recording) {
    if (rec.last_start_ts > 0 && (now - rec.last_start_ts) > ALERT_TIMEOUT_S) return "orange";
    return "green";
  }
  if (rec.last_activity_ts > 0 && (now - rec.last_activity_ts) > ALERT_TIMEOUT_S) return "orange";
  return "grey";
}

function trackerSym(state) {
  return { OK: "●", WARN: "▲", ERROR: "●", DISCONNECTED: "○" }[state] ?? "?";
}

function formatTs(ts) {
  if (!ts || ts === 0) return "--:--:--";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR");
}

function fmtDuration(s) {
  return `${Number(s).toFixed(1)}s`;
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "14px 20px",
      minWidth: 130,
      position: "relative",
      overflow: "hidden",
      flex: "0 0 auto",
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

// ── TrackerCell ──────────────────────────────────────────────────────────────
function Cell({ text, fg, bg, align = "center", style = {} }) {
  return (
    <td style={{
      color: fg || C.text,
      background: bg || "transparent",
      textAlign: align,
      fontFamily: "monospace",
      fontSize: 12,
      fontWeight: 600,
      padding: "6px 4px",
      borderRight: `1px solid ${C.border}`,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {text}
    </td>
  );
}

// ── IndividualRow ─────────────────────────────────────────────────────────────
function IndividualRow({ ind, rowIndex }) {
  const bg = rowIndex % 2 === 0 ? C.bgRow : C.bgRowAlt;

  const tr = ind.tracker_right;
  const tl = ind.tracker_left;
  const th = ind.tracker_head;

  const trCol = trackerColor(tr, ind.connected);
  const tlCol = trackerColor(tl, ind.connected);
  const thCol = trackerColor(th, ind.connected);

  const pdCol = connColor(ind.pince_droite?.connected, ind.connected);
  const pgCol = connColor(ind.pince_gauche?.connected, ind.connected);
  const c1Col = connColor(ind.camera1?.connected, ind.connected);
  const c2Col = connColor(ind.camera2?.connected, ind.connected);
  const c3Col = connColor(ind.camera3?.connected, ind.connected);

  const rc = recordingColor(ind.recording, ind.connected);
  const recSym = ind.recording?.is_recording ? "⏺ REC" : "⏹ OFF";

  return (
    <tr style={{ background: bg }}>
      <Cell text={ind.id}           fg={C.accent}   bg={bg}  align="center" />
      <Cell text={ind.operator||"—"} fg={C.text}    bg={bg}  align="left"   />
      <Cell text={ind.scenario||"—"} fg={C.textDim} bg={bg}  align="left"   />

      <Cell text={`${trackerSym(tr.state)} ${tr.state}`} fg={FG[trCol]} bg={BG[trCol]} />
      <Cell text={Number(tr.value).toFixed(2)}           fg={FG[trCol]} bg={BG[trCol]} />
      <Cell text={`${trackerSym(tl.state)} ${tl.state}`} fg={FG[tlCol]} bg={BG[tlCol]} />
      <Cell text={Number(tl.value).toFixed(2)}           fg={FG[tlCol]} bg={BG[tlCol]} />
      <Cell text={`${trackerSym(th.state)} ${th.state}`} fg={FG[thCol]} bg={BG[thCol]} />
      <Cell text={Number(th.value).toFixed(2)}           fg={FG[thCol]} bg={BG[thCol]} />

      <Cell text={ind.pince_droite?.connected ? "●" : "○"} fg={FG[pdCol]} bg={BG[pdCol]} />
      <Cell text={ind.pince_gauche?.connected ? "●" : "○"} fg={FG[pgCol]} bg={BG[pgCol]} />
      <Cell text={ind.camera1?.connected ? "●" : "○"} fg={FG[c1Col]} bg={BG[c1Col]} />
      <Cell text={ind.camera2?.connected ? "●" : "○"} fg={FG[c2Col]} bg={BG[c2Col]} />
      <Cell text={ind.camera3?.connected ? "●" : "○"} fg={FG[c3Col]} bg={BG[c3Col]} />

      <Cell text={recSym}                        fg={FG[rc]} bg={BG[rc]} />
      <Cell text={fmtDuration(ind.recording?.duration_s ?? 0)} fg={FG[rc]} bg={BG[rc]} />
      <Cell text={formatTs(ind.last_ts)} fg={C.textDim} bg={bg} />
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrchestrateurPage() {
  const [data, setData]       = useState(null);
  const [clock, setClock]     = useState("");
  const [blink, setBlink]     = useState(true);
  const [kafkaStatus, setKafkaStatus] = useState("connecting");
  const intervalRef = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("fr-FR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Blink dot
  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 900);
    return () => clearInterval(id);
  }, []);

  // Poll backend
  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get("/api/orchestrateur");
      setData(res.data);
      setKafkaStatus(res.data.connected ? "connected" : "disconnected");
    } catch {
      setKafkaStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const stats   = data?.stats    ?? { total: 0, ok: 0, warn: 0, error: 0, recording: 0, disconnected: 0 };
  const inds    = data?.individuals ?? [];

  const statusLabel = {
    connected:    `✓  192.168.88.4:9092  [topic1]`,
    disconnected: `—  192.168.88.4:9092  Déconnecté`,
    error:        `⚠  192.168.88.4:9092  Erreur`,
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

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Kafka indicator */}
          <div style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: blink && kafkaStatus === "connected" ? C.ok : C.bgCard,
              transition: "background 0.2s",
            }} />
            <span style={{ color: C.textDim, fontSize: 12 }}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding: "20px 24px 0", display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <StatCard icon="▣" label="Individus"       value={stats.total}      accent={C.accent} />
        <StatCard icon="●" label="OK"               value={stats.ok}         accent={C.ok}     />
        <StatCard icon="▲" label="Alertes"          value={stats.warn}       accent={C.warn}   />
        <StatCard icon="●" label="Erreurs"          value={stats.error}      accent={C.error}  />
        <StatCard icon="⏺" label="Enregistrements" value={stats.recording}  accent={C.rec}    />
        <StatCard icon="○" label="Déconnectés"      value={stats.disconnected} accent={C.grey} />
      </div>

      {/* Table section */}
      <div style={{ padding: "18px 24px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Individus en temps réel</span>
            <span style={{ display: "flex", gap: 12 }}>
              {[["●", "OK", C.ok], ["▲", "Warning", C.warn], ["●", "Erreur", C.error], ["○", "Déconnecté", C.grey]].map(([sym, lbl, col]) => (
                <span key={lbl} style={{ color: col, fontSize: 11 }}>{sym} {lbl}</span>
              ))}
            </span>
          </div>
          <span style={{ color: C.textDim, fontSize: 11 }}>{inds.length} connectés</span>
        </div>

        {/* Table container */}
        <div style={{
          flex: 1,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          background: C.bgSurface,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
        }}>
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              {/* Column widths */}
              <colgroup>
                {COLUMNS.map(col => (
                  <col key={col.key} style={{ width: col.w }} />
                ))}
              </colgroup>

              {/* Header */}
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: C.bgHeader }}>
                  {COLUMNS.map(col => (
                    <th key={col.key} style={{
                      color: C.textDim,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "center",
                      padding: "8px 4px",
                      borderRight: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.borderLight}`,
                      whiteSpace: "nowrap",
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {inds.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{
                      textAlign: "center",
                      color: C.textMuted,
                      padding: "60px 0",
                      fontSize: 13,
                    }}>
                      {kafkaStatus === "connecting" ? "Connexion au broker Kafka…" : "En attente de données (topic1)…"}
                    </td>
                  </tr>
                ) : (
                  inds.map((ind, i) => (
                    <IndividualRow key={ind.id} ind={ind} rowIndex={i} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
