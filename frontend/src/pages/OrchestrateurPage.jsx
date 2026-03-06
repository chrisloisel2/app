import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

// ── Palette ──────────────────────────────────────────────────────────────────
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
  { key: "station",    label: "Station",      w: "8rem",  align: "left"   },
  { key: "operator",   label: "Opérateur",    w: "9rem",  align: "left"   },
  { key: "scenario",   label: "Scénario",     w: "11rem", align: "left"   },
  { key: "cameras",    label: "Caméras",      w: "6rem",  align: "center" },
  { key: "pince_r",    label: "PinD",         w: "4rem",  align: "center" },
  { key: "pince_l",    label: "PinG",         w: "4rem",  align: "center" },
  { key: "trackers",   label: "Trackers",     w: "10rem", align: "center" },
  { key: "rec",        label: "REC",          w: "5rem",  align: "center" },
  { key: "duration",   label: "Durée",        w: "5rem",  align: "center" },
  { key: "ts",         label: "MAJ",          w: "6rem",  align: "center" },
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

// ── StatCard ──────────────────────────────────────────────────────────────────
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

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ children, fg, bg, align = "center", style = {} }) {
  return (
    <td style={{
      color: fg || C.text,
      background: bg || "transparent",
      textAlign: align,
      fontFamily: "monospace",
      fontSize: 12,
      fontWeight: 600,
      padding: "6px 6px",
      borderRight: `1px solid ${C.border}`,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </td>
  );
}

// ── TrackersSummary ───────────────────────────────────────────────────────────
function TrackersSummary({ trackers, connected }) {
  const list = Object.values(trackers || {});
  if (!connected || list.length === 0) {
    return <span style={{ color: C.grey }}>—</span>;
  }
  return (
    <span style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
      {list.map((t) => {
        const col = !t.tracking ? FG.warn : (t.battery !== undefined && t.battery < 0.05 ? FG.error : FG.ok);
        const label = `T${t.idx}`;
        const title = [
          t.serial,
          t.tracking ? "tracking OK" : "tracking PERDU",
          t.battery !== undefined ? `bat ${Math.round(t.battery * 100)}%` : null,
        ].filter(Boolean).join(" · ");
        return (
          <span key={t.idx} title={title} style={{ color: col, fontSize: 11 }}>
            {t.tracking ? "●" : "▲"}{label}
          </span>
        );
      })}
    </span>
  );
}

// ── StationRow ────────────────────────────────────────────────────────────────
function StationRow({ station, rowIndex }) {
  const bg = rowIndex % 2 === 0 ? C.bgRow : C.bgRowAlt;
  const rc = recordingColor(station.recording, station.connected);
  const recSym = station.recording?.is_recording ? "⏺ REC" : "⏹ OFF";
  const cameras = station.cameras || [];
  const matchedCams = cameras.filter(c => c.db_match).length;

  return (
    <tr style={{ background: bg, opacity: station.connected ? 1 : 0.5 }}>
      <Cell fg={C.accent} bg={bg} align="left">
        {station.station_id}
      </Cell>
      <Cell fg={C.text} bg={bg} align="left">
        {station.operator || "—"}
      </Cell>
      <Cell fg={C.textDim} bg={bg} align="left">
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

      {/* Pince droite */}
      <Cell bg={station.pinces?.right?.connected ? BG.ok : BG.grey}>
        {connDot(station.pinces?.right?.connected)}
      </Cell>

      {/* Pince gauche */}
      <Cell bg={station.pinces?.left?.connected ? BG.ok : BG.grey}>
        {connDot(station.pinces?.left?.connected)}
      </Cell>

      {/* Trackers */}
      <Cell bg={bg}>
        <TrackersSummary trackers={station.trackers} connected={station.connected} />
      </Cell>

      {/* REC */}
      <Cell fg={FG[rc]} bg={BG[rc]}>
        {recSym}
      </Cell>

      {/* Durée */}
      <Cell fg={FG[rc]} bg={BG[rc]}>
        {fmtDuration(station.recording?.duration_s)}
      </Cell>

      {/* MAJ */}
      <Cell fg={C.textDim} bg={bg}>
        {formatTs(station.last_ts)}
      </Cell>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrchestrateurPage() {
  const [data, setData]             = useState(null);
  const [clock, setClock]           = useState("");
  const [blink, setBlink]           = useState(true);
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

  const stats    = data?.stats    ?? { total: 0, connected: 0, recording: 0, disconnected: 0 };
  const stations = data?.stations ?? [];

  const statusLabel = {
    connected:    `✓  192.168.88.4:9092  [topic2]`,
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

      {/* Stats bar */}
      <div style={{ padding: "20px 24px 0", display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <StatCard icon="▣" label="Stations"        value={stats.total}        accent={C.accent} />
        <StatCard icon="●" label="Connectées"       value={stats.connected}    accent={C.ok}     />
        <StatCard icon="⏺" label="Enregistrements" value={stats.recording}    accent={C.rec}    />
        <StatCard icon="○" label="Déconnectées"     value={stats.disconnected} accent={C.grey}   />
      </div>

      {/* Table */}
      <div style={{ padding: "18px 24px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Stations en temps réel</span>
          <span style={{ color: C.textDim, fontSize: 11 }}>{stations.length} station(s)</span>
        </div>

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
              <colgroup>
                {COLUMNS.map(col => <col key={col.key} style={{ width: col.w }} />)}
              </colgroup>
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
              <tbody>
                {stations.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{
                      textAlign: "center",
                      color: C.textMuted,
                      padding: "60px 0",
                      fontSize: 13,
                    }}>
                      {kafkaStatus === "connecting"
                        ? "Connexion au broker Kafka…"
                        : "En attente d'événements KafkaEventPublisher (topic2)…"}
                    </td>
                  </tr>
                ) : (
                  stations.map((st, i) => (
                    <StationRow key={st.station_id} station={st} rowIndex={i} />
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
