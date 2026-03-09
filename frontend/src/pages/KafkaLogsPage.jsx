import { useEffect, useRef, useState, useCallback } from "react";

const MAX_LINES = 500;

// ── Couleur par topic ─────────────────────────────────────────────────────────
const TOPIC_COLOR = {
  monitoring: "#a855f7",
};

// ── Couleur par type d'événement ──────────────────────────────────────────────
const TYPE_COLOR = {
  operator_connected:      "#22c55e",
  app_closed:              "#f87171",
  station_disconnected:    "#f87171",
  station_alert:           "#ef4444",
  recording_started:       "#a855f7",
  recording_stopped:       "#7c3aed",
  session_failed:          "#ef4444",
  gripper_connected:       "#22d3ee",
  gripper_disconnected:    "#64748b",
  gripper_switch_on:       "#f59e0b",
  gripper_switch_off:      "#64748b",
  tracker_connected:       "#22d3ee",
  tracker_disconnected:    "#64748b",
  tracker_lost:            "#f59e0b",
  tracker_recovered:       "#22c55e",
  tracker_low_battery:     "#f59e0b",
  tracker_critical_battery:"#ef4444",
  cameras_detected:        "#22d3ee",
  upload_queued:           "#6366f1",
  upload_started:          "#f59e0b",
  upload_completed:        "#22c55e",
  upload_failed:           "#ef4444",
};

function typeColor(type) {
  return TYPE_COLOR[type] ?? "#94a3b8";
}

// ── Formatage d'un champ JSON inline (colorisé) ───────────────────────────────
function InlineJson({ obj }) {
  const entries = Object.entries(obj).filter(([k]) =>
    !["type", "station_id", "ts", "operator", "scenario", "source"].includes(k)
  );
  if (entries.length === 0) return null;
  return (
    <span style={{ color: "#475569", fontSize: 11 }}>
      {" · "}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && <span style={{ color: "#334155" }}> · </span>}
          <span style={{ color: "#64748b" }}>{k}</span>
          <span style={{ color: "#334155" }}>:</span>
          <span style={{ color: typeof v === "boolean" ? (v ? "#22c55e" : "#f87171") : typeof v === "number" ? "#f59e0b" : "#e2e8f0" }}>
            {JSON.stringify(v)}
          </span>
        </span>
      ))}
    </span>
  );
}

// ── Une ligne de log ──────────────────────────────────────────────────────────
function LogLine({ entry }) {
  const raw    = entry.raw;
  const topic  = entry.topic;
  const type   = raw.type ?? raw.source ?? "?";
  const ts     = new Date(entry.ts * 1000).toLocaleTimeString("fr-FR", { hour12: false, fractionalSecondDigits: 3 });

  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      padding: "2px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.02)",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: "20px",
    }}>
      {/* Timestamp */}
      <span style={{ color: "#334155", flexShrink: 0, fontSize: 11 }}>{ts}</span>

      {/* Topic badge */}
      <span style={{
        color: TOPIC_COLOR[topic] ?? "#94a3b8",
        border: `1px solid ${TOPIC_COLOR[topic] ?? "#94a3b8"}44`,
        borderRadius: 3,
        padding: "0 4px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}>
        {topic}
      </span>

      {/* Station */}
      {raw.station_id && (
        <span style={{ color: "#6366f1", flexShrink: 0, minWidth: 60 }}>
          {raw.station_id}
        </span>
      )}

      {/* Type */}
      <span style={{ color: typeColor(type), fontWeight: 600, flexShrink: 0 }}>
        {type}
      </span>

      {/* Operator / scenario */}
      {(raw.operator || raw.scenario) && (
        <span style={{ color: "#475569", flexShrink: 0 }}>
          {[raw.operator, raw.scenario].filter(Boolean).join(" · ")}
        </span>
      )}

      {/* Extra fields */}
      <InlineJson obj={raw} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function KafkaLogsPage() {
  const [lines, setLines]           = useState([]);
  const [paused, setPaused]         = useState(false);
  const [filter, setFilter]         = useState("");
  const [wsStatus, setWsStatus]     = useState("connecting");
  const [kafkaStatus, setKafkaStatus] = useState({ connected: null, error: null });
  const bottomRef  = useRef(null);
  const pausedRef  = useRef(false);
  const pendingRef = useRef([]);

  pausedRef.current = paused;

  const flush = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    const batch = pendingRef.current.splice(0);
    setLines(prev => {
      const next = [...prev, ...batch];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [lines, paused]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/api/kafka-logs/ws`;
    let ws;
    let reconnectTimer;
    let flushTimer;

    const connect = () => {
      setWsStatus("connecting");
      ws = new WebSocket(url);

      ws.onopen  = () => setWsStatus("connected");
      ws.onerror = () => setWsStatus("error");
      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onmessage = (e) => {
        try {
          const entry = JSON.parse(e.data);
          if (entry.topic === "__status__") {
            setKafkaStatus({ connected: entry.raw.kafka_connected, error: entry.raw.error ?? null });
            return;
          }
          if (!pausedRef.current) {
            pendingRef.current.push(entry);
          }
        } catch { /* ignore */ }
      };

      // Batch flush every 100ms
      flushTimer = setInterval(flush, 100);
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(flushTimer);
      ws?.close();
    };
  }, [flush]);

  const filtered = filter
    ? lines.filter(l => {
        const haystack = JSON.stringify(l.raw).toLowerCase() + l.topic;
        return haystack.includes(filter.toLowerCase());
      })
    : lines;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#020817",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "#0a0f1e",
        borderBottom: "1px solid rgba(99,102,241,0.2)",
        flexShrink: 0,
      }}>
        <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
          KAFKA LOGS
        </span>

        {/* Topics */}
        {Object.entries(TOPIC_COLOR).map(([t, c]) => (
          <span key={t} style={{
            color: c, border: `1px solid ${c}44`, borderRadius: 3,
            padding: "1px 6px", fontSize: 10, fontWeight: 700,
          }}>{t}</span>
        ))}

        {/* WS Status */}
        <span style={{
          display: "flex", alignItems: "center", gap: 5,
          marginLeft: 4,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: wsStatus === "connected" ? "#22c55e" : wsStatus === "connecting" ? "#f59e0b" : "#ef4444",
            boxShadow: wsStatus === "connected" ? "0 0 5px #22c55e88" : undefined,
          }} />
          <span style={{ color: "#475569", fontSize: 10 }}>ws:{wsStatus}</span>
        </span>

        {/* Kafka Status */}
        <span style={{
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: kafkaStatus.connected === null ? "#64748b" : kafkaStatus.connected ? "#22c55e" : "#ef4444",
            boxShadow: kafkaStatus.connected ? "0 0 5px #22c55e88" : undefined,
          }} />
          <span style={{ color: "#475569", fontSize: 10 }}>
            kafka:{kafkaStatus.connected === null ? "…" : kafkaStatus.connected ? "ok" : "erreur"}
          </span>
        </span>

        {/* Filter */}
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrer…"
          style={{
            marginLeft: "auto",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 4,
            padding: "4px 10px",
            color: "#e2e8f0",
            fontSize: 12,
            outline: "none",
            width: 200,
            fontFamily: "inherit",
          }}
        />

        {/* Pause */}
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            background: paused ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.1)",
            border: `1px solid ${paused ? "rgba(245,158,11,0.4)" : "rgba(99,102,241,0.3)"}`,
            color: paused ? "#f59e0b" : "#6366f1",
            borderRadius: 4,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {paused ? "▶ REPRENDRE" : "⏸ PAUSE"}
        </button>

        {/* Clear */}
        <button
          onClick={() => setLines([])}
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
            borderRadius: 4,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          CLEAR
        </button>

        <span style={{ color: "#334155", fontSize: 10 }}>{filtered.length} lignes</span>
      </div>

      {/* Log area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        background: "#020817",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", gap: 8,
          }}>
            {kafkaStatus.connected === false ? (
              <>
                <span style={{ color: "#ef4444", fontSize: 13, letterSpacing: 1 }}>
                  Kafka déconnecté
                </span>
                {kafkaStatus.error && (
                  <span style={{ color: "#64748b", fontSize: 11, maxWidth: 500, textAlign: "center", wordBreak: "break-all" }}>
                    {kafkaStatus.error}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "#1e293b", fontSize: 13, letterSpacing: 1 }}>
                {wsStatus === "connected" ? "En attente de messages Kafka…" : "Connexion…"}
              </span>
            )}
          </div>
        ) : (
          filtered.map((entry, i) => <LogLine key={i} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
