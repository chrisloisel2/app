import { useEffect, useState, useRef } from "react";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function fmtTs(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  return d.toLocaleTimeString("fr-FR");
}

function AgeSince({ tsRef }) {
  const [age, setAge] = useState("—");
  useEffect(() => {
    const tick = () => {
      const ts = tsRef.current;
      if (!ts) { setAge("—"); return; }
      const secs = Math.floor(Date.now() / 1000 - ts);
      if (secs < 0) { setAge("0s"); return; }
      if (secs < 60) setAge(`${secs}s`);
      else setAge(`${Math.floor(secs / 60)}m ${secs % 60}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tsRef]);
  return <span style={{ color: "#64748b", fontSize: 9 }}>{age} ago</span>;
}

function Badge({ ok, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700,
      background: ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
      color: ok ? "#22c55e" : "#ef4444",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: ok ? "#22c55e" : "#ef4444",
        boxShadow: ok ? "0 0 4px rgba(34,197,94,0.7)" : "0 0 4px rgba(239,68,68,0.7)",
      }} />
      {label}
    </span>
  );
}

function Gauge({ pct, color = "#22d3ee" }) {
  const p = Math.min(100, Math.max(0, pct ?? 0));
  const warn = p > 85;
  const c = warn ? "#f59e0b" : color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${p}%`, height: "100%", background: c,
          boxShadow: `0 0 6px ${c}88`, borderRadius: 3,
          transition: "width 0.4s",
        }} />
      </div>
      <span style={{ color: warn ? "#f59e0b" : "#94a3b8", fontSize: 9, minWidth: 28, textAlign: "right" }}>
        {p.toFixed(1)}%
      </span>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ color: "#4b5563", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#cbd5e1", fontSize: 10, fontFamily: mono ? "monospace" : undefined, textAlign: "right" }}>{value ?? "—"}</span>
    </div>
  );
}

// ── Carte station (PC d'acquisition) ─────────────────────────────────────────
function StationCard({ hb, lastTsRef }) {
  const isOk = !!hb;

  return (
    <div style={{
      background: "rgba(15,23,42,0.9)",
      border: `1px solid ${isOk ? "rgba(34,197,94,0.3)" : "rgba(107,114,128,0.2)"}`,
      borderRadius: 8, padding: "12px 14px",
      boxShadow: isOk ? "0 0 14px rgba(34,197,94,0.07)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
            {hb?.station_id ?? "—"}
          </span>
          <Badge ok={isOk} label={isOk ? "VIVANT" : "ABSENT"} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ color: "#374151", fontSize: 9 }}>{fmtTs(hb?.ts)}</span>
          {lastTsRef && <AgeSince tsRef={lastTsRef} />}
        </div>
      </div>

      <Row label="Opérateur"   value={hb ? `${hb.operator_firstname ?? ""} ${hb.operator_lastname ?? ""}`.trim() || hb.operator : null} />
      <Row label="Scénario"    value={hb?.scenario} mono />
      <Row label="Sessions"    value={hb ? `${hb.sessions_count ?? 0} (${hb.sessions?.slice(-2).join(", ") ?? ""})` : null} mono />

      <div style={{ marginTop: 8 }}>
        <span style={{ color: "#374151", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>Disque</span>
        <div style={{ marginTop: 4 }}>
          <Gauge pct={hb?.disk_used_pct} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ color: "#374151", fontSize: 9 }}>Libre: {hb?.disk_free_gb?.toFixed(1) ?? "—"} GB</span>
          <span style={{ color: "#374151", fontSize: 9 }}>Total: {hb?.disk_total_gb?.toFixed(1) ?? "—"} GB</span>
        </div>
      </div>
    </div>
  );
}

// ── Uptime formatter ──────────────────────────────────────────────────────────
function uptimeFmt(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

// ── Uptime live (incrémente chaque seconde depuis le ts du heartbeat) ─────────
function UptimeLive({ baseUptime, baseTsRef }) {
  const [display, setDisplay] = useState(() => uptimeFmt(baseUptime));
  useEffect(() => {
    if (!baseUptime || !baseTsRef) return;
    const tick = () => {
      const elapsed = baseTsRef.current ? Date.now() / 1000 - baseTsRef.current : 0;
      setDisplay(uptimeFmt(baseUptime + Math.max(0, elapsed)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [baseUptime, baseTsRef]);
  return <span style={{ color: "#22d3ee", fontWeight: 700, fontSize: 13 }}>{display}</span>;
}

// ── Pulse dot (clignote quand actif) ─────────────────────────────────────────
function PulseDot({ active, color = "#22c55e", size = 8 }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setOn(v => !v), 900);
    return () => clearInterval(id);
  }, [active]);
  const c = active ? color : "#374151";
  const opacity = active ? (on ? 1 : 0.35) : 0.3;
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: c, opacity,
      boxShadow: active && on ? `0 0 ${size}px ${c}` : "none",
      flexShrink: 0,
      transition: "opacity 0.3s, box-shadow 0.3s",
    }} />
  );
}

// ── Barre de pipeline sessions ────────────────────────────────────────────────
function PipelineBar({ total, pending, uploading, done }) {
  const t = total || 1;
  const doneW     = (done     / t) * 100;
  const uploadW   = (uploading / t) * 100;
  const pendingW  = (pending  / t) * 100;
  return (
    <div style={{ width: "100%", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.04)", display: "flex" }}>
      <div style={{ width: `${doneW}%`,    background: "#22c55e", transition: "width 0.6s", boxShadow: "0 0 6px #22c55e88" }} />
      <div style={{ width: `${uploadW}%`,  background: "#22d3ee", transition: "width 0.6s", boxShadow: "0 0 6px #22d3ee88" }} />
      <div style={{ width: `${pendingW}%`, background: "#f59e0b", transition: "width 0.6s" }} />
    </div>
  );
}

// ── Service pill ──────────────────────────────────────────────────────────────
function ServicePill({ label, ok, detail }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 6,
      background: ok ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
    }}>
      <PulseDot active={ok} color={ok ? "#22c55e" : "#ef4444"} size={7} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: ok ? "#86efac" : "#fca5a5", fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>{label}</span>
        {detail && <span style={{ color: "#374151", fontSize: 8, lineHeight: 1.2 }}>{detail}</span>}
      </div>
    </div>
  );
}

// ── Carte serveur ─────────────────────────────────────────────────────────────
function ServerCard({ hb, lastTsRef }) {
  const isOk = !!hb;
  const diskWarn = (hb?.disk_inbox_used_pct ?? 0) > 85;

  return (
    <div style={{
      background: "rgba(6,12,30,0.97)",
      border: `1px solid ${isOk ? "rgba(34,211,238,0.25)" : "rgba(107,114,128,0.15)"}`,
      borderRadius: 12,
      boxShadow: isOk
        ? "0 0 40px rgba(34,211,238,0.06), inset 0 0 60px rgba(0,0,50,0.3)"
        : "none",
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(34,211,238,0.08)",
        background: "rgba(34,211,238,0.03)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PulseDot active={isOk} color="#22d3ee" size={10} />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
                {hb?.server_id ?? hb?.hostname ?? "—"}
              </span>
              <span style={{ color: "#334155", fontSize: 9 }}>
                {hb?.hostname && hb?.server_id !== hb?.hostname ? hb.hostname : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{
                padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                background: isOk ? "rgba(34,211,238,0.12)" : "rgba(107,114,128,0.12)",
                color: isOk ? "#22d3ee" : "#6b7280",
                border: `1px solid ${isOk ? "rgba(34,211,238,0.25)" : "rgba(107,114,128,0.2)"}`,
              }}>
                {isOk ? "ONLINE" : "OFFLINE"}
              </span>
              {isOk && (
                <span style={{ color: "#334155", fontSize: 9 }}>
                  uptime <UptimeLive baseUptime={hb.uptime_s} baseTsRef={lastTsRef} />
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#1e293b", fontSize: 9 }}>{hb?.ts_iso ?? fmtTs(hb?.ts)}</div>
          {lastTsRef && <AgeSince tsRef={lastTsRef} />}
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Services ── */}
        <div>
          <div style={{ color: "#1e3a5f", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            SERVICES
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ServicePill
              label="Kafka"
              ok={hb?.kafka_ok ?? false}
              detail={hb?.kafka_ok ? "connecté" : "déconnecté"}
            />
            <ServicePill
              label="S3 Sync"
              ok={hb?.s3_sync_active ?? false}
              detail={hb?.s3_sync_active ? `${hb.s3_bucket ?? "—"}/${hb.s3_prefix ?? "—"}` : "inactif"}
            />
          </div>
        </div>

        {/* ── Pipeline sessions ── */}
        <div>
          <div style={{ color: "#1e3a5f", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            PIPELINE SESSIONS · <span style={{ color: "#475569" }}>{hb?.inbox_dir ?? "—"}</span>
          </div>

          {/* Compteurs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10 }}>
            {[
              { label: "Total",     value: hb?.inbox_sessions_count,     color: "#94a3b8", bg: "rgba(148,163,184,0.05)", br: "rgba(148,163,184,0.1)" },
              { label: "Pending",   value: hb?.inbox_sessions_pending,   color: "#f59e0b", bg: "rgba(245,158,11,0.06)",  br: "rgba(245,158,11,0.15)" },
              { label: "Uploading", value: hb?.inbox_sessions_uploading, color: "#22d3ee", bg: "rgba(34,211,238,0.06)", br: "rgba(34,211,238,0.15)" },
              { label: "Done",      value: hb?.inbox_sessions_done,      color: "#22c55e", bg: "rgba(34,197,94,0.06)",  br: "rgba(34,197,94,0.15)"  },
            ].map(({ label, value, color, bg, br }, i, arr) => (
              <div key={label} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                padding: "8px 4px",
                background: bg,
                borderTop: `1px solid ${br}`,
                borderBottom: `1px solid ${br}`,
                borderLeft: `1px solid ${br}`,
                borderRight: i === arr.length - 1 ? `1px solid ${br}` : "none",
                borderRadius: i === 0 ? "6px 0 0 6px" : i === arr.length - 1 ? "0 6px 6px 0" : 0,
              }}>
                <span style={{ color, fontSize: 20, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {value ?? "—"}
                </span>
                <span style={{ color: "#1e293b", fontSize: 7, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Barre de progression */}
          <PipelineBar
            total={hb?.inbox_sessions_count}
            pending={hb?.inbox_sessions_pending}
            uploading={hb?.inbox_sessions_uploading}
            done={hb?.inbox_sessions_done}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
            {[
              { color: "#22c55e", label: "Done" },
              { color: "#22d3ee", label: "Uploading" },
              { color: "#f59e0b", label: "Pending" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: "inline-block" }} />
                <span style={{ color: "#1e293b", fontSize: 8 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Disque ── */}
        <div>
          <div style={{ color: "#1e3a5f", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            DISQUE INBOX
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {/* Anneau disque */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
                <circle
                  cx={28} cy={28} r={22}
                  fill="none"
                  stroke={diskWarn ? "#f59e0b" : "#22d3ee"}
                  strokeWidth={5}
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - (hb?.disk_inbox_used_pct ?? 0) / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s, stroke 0.3s", filter: `drop-shadow(0 0 4px ${diskWarn ? "#f59e0b" : "#22d3ee"})` }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: diskWarn ? "#f59e0b" : "#22d3ee", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                  {(hb?.disk_inbox_used_pct ?? 0).toFixed(0)}%
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#334155", fontSize: 9 }}>Utilisé</span>
                <span style={{ color: diskWarn ? "#f59e0b" : "#94a3b8", fontSize: 9, fontWeight: 600 }}>
                  {hb ? ((hb.disk_inbox_total_gb - hb.disk_inbox_free_gb) || 0).toFixed(1) : "—"} GB
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#334155", fontSize: 9 }}>Libre</span>
                <span style={{ color: "#22c55e", fontSize: 9, fontWeight: 600 }}>
                  {hb?.disk_inbox_free_gb?.toFixed(1) ?? "—"} GB
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#334155", fontSize: 9 }}>Total</span>
                <span style={{ color: "#475569", fontSize: 9 }}>
                  {hb?.disk_inbox_total_gb?.toFixed(1) ?? "—"} GB
                </span>
              </div>
            </div>
          </div>
          {diskWarn && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 4,
              padding: "4px 8px", borderRadius: 5,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
            }}>
              <span style={{ color: "#f59e0b", fontSize: 9 }}>⚠ Disque quasi plein — plus de 85% utilisé</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Vue principale ────────────────────────────────────────────────────────────
export default function DataView({ wsData }) {
  // serversMap : server_id → { hb, tsRef }
  const [serversMap, setServersMap] = useState(() => new Map());
  const [stations, setStations]     = useState([]);
  const stationTsRefs               = useRef({});
  const serverTsRefs                = useRef({});

  useEffect(() => {
    if (!wsData) return;

    // Heartbeats stations
    const stationHbs = wsData.station_heartbeats ?? [];
    if (stationHbs.length > 0) {
      setStations(stationHbs);
      for (const hb of stationHbs) {
        if (!stationTsRefs.current[hb.station_id]) stationTsRefs.current[hb.station_id] = { current: null };
        stationTsRefs.current[hb.station_id].current = hb.ts;
      }
    }

    // Heartbeat serveur unique
    if (wsData.server_heartbeat) {
      const hb = wsData.server_heartbeat;
      const key = hb.server_id ?? hb.hostname ?? "server";
      if (!serverTsRefs.current[key]) serverTsRefs.current[key] = { current: null };
      serverTsRefs.current[key].current = hb.ts;
      setServersMap(prev => new Map(prev).set(key, hb));
    }

    // Tableau de heartbeats serveurs
    const serverHbs = wsData.server_heartbeats ?? [];
    for (const hb of serverHbs) {
      const key = hb.server_id ?? hb.hostname ?? "server";
      if (!serverTsRefs.current[key]) serverTsRefs.current[key] = { current: null };
      serverTsRefs.current[key].current = hb.ts;
      setServersMap(prev => new Map(prev).set(key, hb));
    }
  }, [wsData]);

  const servers = Array.from(serversMap.entries()); // [[key, hb], ...]

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>

      {/* ── Serveurs ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ color: "rgba(34,211,238,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            SERVEURS
          </span>
          <span style={{
            padding: "1px 7px", borderRadius: 10, fontSize: 8, fontWeight: 700,
            background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)",
            color: "#22d3ee",
          }}>
            {servers.length}
          </span>
        </div>

        {servers.length === 0 ? (
          <div style={{
            background: "rgba(15,23,42,0.5)", border: "1px solid rgba(34,211,238,0.08)",
            borderRadius: 10, padding: "28px", textAlign: "center",
            color: "#1e3a5f", fontSize: 11,
          }}>
            Aucun heartbeat serveur reçu via WebSocket.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
            gap: 16,
          }}>
            {servers.map(([key, hb]) => (
              <ServerCard
                key={key}
                hb={hb}
                lastTsRef={serverTsRefs.current[key]}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Stations ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ color: "rgba(34,197,94,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            STATIONS
          </span>
          <span style={{
            padding: "1px 7px", borderRadius: 10, fontSize: 8, fontWeight: 700,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
            color: "#22c55e",
          }}>
            {stations.length}
          </span>
        </div>
        {stations.length === 0 ? (
          <div style={{
            background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "28px", textAlign: "center",
            color: "#1e293b", fontSize: 11,
          }}>
            Aucun heartbeat station reçu via WebSocket.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}>
            {stations.map((hb) => (
              <StationCard
                key={hb.station_id}
                hb={hb}
                lastTsRef={stationTsRefs.current[hb.station_id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
