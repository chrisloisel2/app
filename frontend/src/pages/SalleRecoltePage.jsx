import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#020817",
  bgCard:      "#0a1020",
  bgRow:       "#0d1628",
  bgRowAlt:    "#0a1020",
  border:      "rgba(99,102,241,0.2)",
  borderLight: "rgba(99,102,241,0.35)",
  text:        "#e2e8f0",
  textDim:     "#64748b",
  accent:      "#6366f1",
  ok:          "#22c55e",
  warn:        "#f59e0b",
  error:       "#ef4444",
  rec:         "#a855f7",
  grey:        "#374151",
};

const FG = { ok: "#22c55e", warn: "#f59e0b", error: "#ef4444", grey: "#4b5563", rec: "#a855f7" };
const BG = { ok: "rgba(34,197,94,0.08)", warn: "rgba(245,158,11,0.08)", error: "rgba(239,68,68,0.08)", grey: "rgba(55,65,81,0.08)", rec: "rgba(168,85,247,0.08)" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts || ts === 0) return "—";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR");
}

function fmtDuration(s) {
  if (!s || s === 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m${sec.toString().padStart(2,"0")}s` : `${Math.round(s)}s`;
}

function stationStatus(st) {
  if (!st.connected) return "grey";
  if (st.recording?.failed) return "error";
  if (st.recording?.is_recording) return "rec";
  return "ok";
}

// ── Colonnes ──────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "station",   label: "Station",    w: "7rem",  align: "left"   },
  { key: "operator",  label: "Opérateur",  w: "9rem",  align: "left"   },
  { key: "scenario",  label: "Scénario",   w: "10rem", align: "left"   },
  { key: "cameras",   label: "Caméras",    w: "5.5rem", align: "center" },
  { key: "pince_r",   label: "PinD",       w: "4rem",  align: "center" },
  { key: "pince_l",   label: "PinG",       w: "4rem",  align: "center" },
  { key: "trackers",  label: "Trackers",   w: "10rem", align: "center" },
  { key: "rec",       label: "REC",        w: "5.5rem", align: "center" },
  { key: "duration",  label: "Durée",      w: "5rem",  align: "center" },
  { key: "ts",        label: "MAJ",        w: "6rem",  align: "center" },
];

// ── Cell ──────────────────────────────────────────────────────────────────────
function Cell({ children, fg, bg, align = "center" }) {
  return (
    <td style={{
      color: fg || C.text,
      background: bg || "transparent",
      textAlign: align,
      fontSize: 12,
      fontWeight: 500,
      fontFamily: "'JetBrains Mono', monospace",
      padding: "7px 8px",
      borderRight: `1px solid ${C.border}`,
      whiteSpace: "nowrap",
    }}>
      {children}
    </td>
  );
}

// ── TrackersSummary ───────────────────────────────────────────────────────────
function TrackersSummary({ trackers, connected }) {
  const list = Object.values(trackers || {});
  if (!connected || list.length === 0) return <span style={{ color: C.grey }}>—</span>;
  return (
    <span style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
      {list.map((t) => {
        const col = !t.tracking
          ? FG.warn
          : (t.battery !== undefined && t.battery < 0.05 ? FG.error : FG.ok);
        const title = [
          t.serial,
          t.tracking ? "tracking OK" : "PERDU",
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
}

// ── StationRow ────────────────────────────────────────────────────────────────
const StationRow = memo(function StationRow({ station, rowIndex }) {
  const bg     = rowIndex % 2 === 0 ? C.bgRow : C.bgRowAlt;
  const sc     = stationStatus(station);
  const cameras = station.cameras || [];
  const matched = cameras.filter(c => c.db_match).length;

  const recLabel = station.recording?.is_recording ? "⏺ REC" : "⏹ OFF";
  const recFg    = station.recording?.failed ? FG.error : FG.rec;
  const recBg    = station.recording?.is_recording ? BG.rec : BG.grey;

  return (
    <tr style={{
      background: bg,
      opacity: station.connected ? 1 : 0.45,
      transition: "opacity 0.3s",
    }}>
      {/* Station */}
      <Cell fg={C.accent} bg={bg} align="left">
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: FG[sc],
            boxShadow: `0 0 5px ${FG[sc]}88`,
            flexShrink: 0,
          }} />
          {station.station_id}
        </span>
      </Cell>

      {/* Opérateur */}
      <Cell fg={station.operator ? C.text : C.textDim} bg={bg} align="left">
        {station.operator || "—"}
      </Cell>

      {/* Scénario */}
      <Cell fg={station.scenario ? "#94a3b8" : C.textDim} bg={bg} align="left">
        {station.scenario || "—"}
      </Cell>

      {/* Caméras */}
      <Cell bg={bg}>
        {cameras.length > 0
          ? <span style={{ color: matched === cameras.length ? FG.ok : FG.warn }}>
              {matched}/{cameras.length}
            </span>
          : <span style={{ color: C.grey }}>—</span>
        }
      </Cell>

      {/* Pince droite */}
      <Cell bg={station.pinces?.right?.connected ? BG.ok : BG.grey}>
        <span style={{ color: station.pinces?.right?.connected ? FG.ok : FG.grey, fontSize: 14 }}>
          {station.pinces?.right?.connected ? "●" : "○"}
        </span>
      </Cell>

      {/* Pince gauche */}
      <Cell bg={station.pinces?.left?.connected ? BG.ok : BG.grey}>
        <span style={{ color: station.pinces?.left?.connected ? FG.ok : FG.grey, fontSize: 14 }}>
          {station.pinces?.left?.connected ? "●" : "○"}
        </span>
      </Cell>

      {/* Trackers */}
      <Cell bg={bg}>
        <TrackersSummary trackers={station.trackers} connected={station.connected} />
      </Cell>

      {/* REC */}
      <Cell fg={station.recording?.is_recording ? recFg : FG.grey} bg={recBg}>
        {recLabel}
      </Cell>

      {/* Durée */}
      <Cell fg={station.recording?.is_recording ? FG.rec : FG.grey} bg={recBg}>
        {fmtDuration(station.recording?.duration_s)}
      </Cell>

      {/* MAJ */}
      <Cell fg={C.textDim} bg={bg}>
        {formatTs(station.last_ts)}
      </Cell>
    </tr>
  );
});

// ── StatBadge ─────────────────────────────────────────────────────────────────
function StatBadge({ label, value, color }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "6px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
    }}>
      <span style={{ color, fontSize: 20, fontWeight: 700, lineHeight: 1, fontFamily: "monospace" }}>{value}</span>
      <span style={{ color: C.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
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
    <span style={{ color: C.textDim, fontSize: 10, fontFamily: "monospace" }}>
      màj {display}
    </span>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SalleRecoltePage() {
  const [stationsMap, setStationsMap] = useState(() => new Map());
  const [stats, setStats]             = useState({ total: 0, connected: 0, recording: 0, disconnected: 0 });
  const [kafkaOk, setKafkaOk]         = useState(false);
  const [wsError, setWsError]         = useState(null);
  const lastUpdateRef                 = useRef(null);

  const handleMessage = useCallback((msg) => {
    setKafkaOk(!!msg.connected);
    lastUpdateRef.current = msg.last_update;

    if (msg.stats) setStats(msg.stats);

    const incoming = msg.stations ?? [];
    if (incoming.length === 0) return;

    setStationsMap(prev => {
      const next = new Map(prev);
      for (const st of incoming) next.set(st.station_id, st);
      return next;
    });
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
      ws.onerror = () => setWsError("Erreur WebSocket");
      ws.onclose = () => {
        setWsError("WebSocket déconnecté — reconnexion…");
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onopen = () => setWsError(null);
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, [handleMessage]);

  const stations = useMemo(
    () => Array.from(stationsMap.values()).sort((a, b) => a.station_id.localeCompare(b.station_id)),
    [stationsMap]
  );

  return (
    <div style={{
      minHeight: "100%",
      background: `linear-gradient(135deg, ${C.bg} 0%, #0a1628 50%, ${C.bg} 100%)`,
      padding: "24px",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>

      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>
            SALLE DE RÉCOLTE
          </h1>
          <p style={{ color: C.textDim, fontSize: 11, margin: "3px 0 0" }}>
            Surveillance temps-réel · Kafka topic2 · WebSocket
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LastUpdateLabel lastUpdateRef={lastUpdateRef} />
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px",
            background: "rgba(99,102,241,0.06)",
            border: `1px solid ${kafkaOk ? "rgba(34,211,238,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 6,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: kafkaOk ? "#22d3ee" : "#ef4444",
              boxShadow: kafkaOk ? "0 0 6px rgba(34,211,238,0.7)" : "0 0 6px rgba(239,68,68,0.7)",
            }} />
            <span style={{ color: kafkaOk ? "#22d3ee" : "#ef4444", fontSize: 10, fontWeight: 600 }}>
              {kafkaOk ? "KAFKA CONNECTÉ" : "KAFKA DÉCONNECTÉ"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <StatBadge label="Total"         value={stats.total}        color={C.accent} />
        <StatBadge label="Connectées"    value={stats.connected}    color={FG.ok}    />
        <StatBadge label="Enregistrent"  value={stats.recording}    color={FG.rec}   />
        <StatBadge label="Déconnectées"  value={stats.disconnected} color={FG.grey}  />
      </div>

      {/* Erreur WS */}
      {wsError && (
        <div style={{
          marginBottom: 12, padding: "7px 12px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 6, color: "#f87171", fontSize: 11,
        }}>
          {wsError}
        </div>
      )}

      {/* Table */}
      <div style={{
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        background: "rgba(6,12,30,0.95)",
        overflow: "hidden",
        boxShadow: "0 0 30px rgba(99,102,241,0.08)",
      }}>
        {/* Label blueprint */}
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(2,8,23,0.8)",
        }}>
          <span style={{ color: "rgba(99,102,241,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            POSTES D'ENREGISTREMENT · PLAN DE SALLE
          </span>
          <span style={{ color: C.textDim, fontSize: 10 }}>{stations.length} station(s)</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              {COLUMNS.map(col => <col key={col.key} style={{ width: col.w }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: "rgba(2,8,23,0.9)" }}>
                {COLUMNS.map(col => (
                  <th key={col.key} style={{
                    color: C.textDim,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    textAlign: "center",
                    padding: "8px 6px",
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
                    color: C.textDim,
                    padding: "60px 0",
                    fontSize: 12,
                    letterSpacing: 1,
                  }}>
                    {kafkaOk
                      ? "En attente d'événements KafkaEventPublisher…"
                      : "Connexion au broker Kafka…"}
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
  );
}
