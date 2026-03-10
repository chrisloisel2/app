import { useEffect, useState, useCallback, useRef } from "react";
import { fetchSshParc, deleteSshEntry, clearSshParc } from "../api/client";

// ── Palette worm / terminal ────────────────────────────────────────────────────
const C = {
  bg:        "#030a03",
  bgCard:    "#060f06",
  bgRow:     "#0a170a",
  bgRowHov:  "#0d1f0d",
  border:    "#1a3d1a",
  green:     "#00ff41",
  greenDim:  "#00c832",
  greenFaint:"#004d14",
  greenGlow: "0 0 8px #00ff4166",
  cyan:      "#00e5ff",
  yellow:    "#ffe600",
  red:       "#ff3333",
  gray:      "#3a5c3a",
  grayLight: "#6b9c6b",
  white:     "#e0ffe0",
};

const mono = "'JetBrains Mono','Fira Code','Cascadia Code',monospace";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function since(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)  return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)}j`;
}

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function GlowDot({ color = C.green }) {
  return (
    <span style={{
      display: "inline-block",
      width: 7, height: 7, borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}88`,
      flexShrink: 0,
    }} />
  );
}

function StatCard({ label, value, color = C.green, sub }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "14px 20px",
      minWidth: 130,
    }}>
      <div style={{ color: C.gray, fontSize: 10, fontFamily: mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 26, fontFamily: mono, fontWeight: 700, textShadow: C.greenGlow, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: C.grayLight, fontSize: 10, fontFamily: mono, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copier"
      style={{
        background: "none",
        border: `1px solid ${copied ? C.green : C.greenFaint}`,
        borderRadius: 3,
        color: copied ? C.green : C.gray,
        fontSize: 9,
        fontFamily: mono,
        padding: "1px 6px",
        cursor: "pointer",
        transition: "all .15s",
        flexShrink: 0,
      }}
    >
      {copied ? "✓ copié" : "copy"}
    </button>
  );
}

// ── Ligne de PC ───────────────────────────────────────────────────────────────
function PcRow({ doc, onDelete }) {
  const [hov, setHov] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDelete = () => {
    if (!confirm) { setConfirm(true); return; }
    onDelete(doc._id);
  };

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirm(false); }}
      style={{ background: hov ? C.bgRowHov : C.bgRow, transition: "background .1s" }}
    >
      {/* Status */}
      <td style={{ padding: "10px 14px", width: 28 }}>
        <GlowDot />
      </td>

      {/* Hostname */}
      <td style={{ padding: "10px 0", fontFamily: mono, fontSize: 12, color: C.green, fontWeight: 700 }}>
        {doc.hostname || "—"}
      </td>

      {/* IP */}
      <td style={{ padding: "10px 16px", fontFamily: mono, fontSize: 12, color: C.cyan }}>
        {doc.ip || "—"}
      </td>

      {/* Username */}
      <td style={{ padding: "10px 16px", fontFamily: mono, fontSize: 11, color: C.grayLight }}>
        {doc.username || "—"}
      </td>

      {/* OS */}
      <td style={{ padding: "10px 16px", fontFamily: mono, fontSize: 10, color: C.gray }}>
        {doc.os || "—"} {doc.os_release ? `(${doc.os_release})` : ""}
      </td>

      {/* SSH command */}
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 11, color: C.greenDim,
            background: C.greenFaint, borderRadius: 3,
            padding: "2px 8px", letterSpacing: 0.3,
          }}>
            {doc.ssh_connection_string || "—"}
          </span>
          {doc.ssh_connection_string && <CopyBtn text={doc.ssh_connection_string} />}
        </div>
      </td>

      {/* Timestamp */}
      <td style={{ padding: "10px 16px", fontFamily: mono, fontSize: 10, color: C.gray, whiteSpace: "nowrap" }}>
        <span title={fmtTs(doc.timestamp)}>{since(doc.timestamp)}</span>
      </td>

      {/* Actions */}
      <td style={{ padding: "10px 14px", textAlign: "right" }}>
        <button
          onClick={handleDelete}
          style={{
            background: confirm ? "rgba(255,51,51,.15)" : "none",
            border: `1px solid ${confirm ? C.red : C.greenFaint}`,
            borderRadius: 3,
            color: confirm ? C.red : C.gray,
            fontSize: 9,
            fontFamily: mono,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          {confirm ? "confirmer" : "retirer"}
        </button>
      </td>
    </tr>
  );
}

// ── Scanline overlay déco ─────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,.015) 2px,rgba(0,255,65,.015) 4px)",
    }} />
  );
}

// ── Header ASCII art ──────────────────────────────────────────────────────────
const ASCII = `
 ███████╗███████╗██╗  ██╗    ██╗    ██╗ ██████╗ ██████╗ ███╗   ███╗
 ██╔════╝██╔════╝██║  ██║    ██║    ██║██╔═══██╗██╔══██╗████╗ ████║
 ███████╗███████╗███████║    ██║ █╗ ██║██║   ██║██████╔╝██╔████╔██║
 ╚════██║╚════██║██╔══██║    ██║███╗██║██║   ██║██╔══██╗██║╚██╔╝██║
 ███████║███████║██║  ██║    ╚███╔███╔╝╚██████╔╝██║  ██║██║ ╚═╝ ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝     ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝`.trim();

// ── Terminal broadcast ────────────────────────────────────────────────────────
function BroadcastTerminal({ docs }) {
  const [input, setInput]       = useState("");
  const [history, setHistory]   = useState([]); // { cmd, results: [{hostname,ip,stdout,stderr,exit_code}], running, total }
  const [histIdx, setHistIdx]   = useState(-1);
  const [cmdHistory, setCmdHistory] = useState([]);
  const outputRef = useRef(null);
  const inputRef  = useRef(null);

  // Scroll en bas à chaque update
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [history]);

  const idxRef = useRef(0);

  const runCommand = () => {
    const cmd = input.trim();
    if (!cmd) return;

    setCmdHistory(h => [cmd, ...h.filter(c => c !== cmd)]);
    setHistIdx(-1);
    setInput("");

    const entry = { cmd, results: [], running: true, total: 0, ts: Date.now() };
    // Capture l'index de manière stable via ref
    setHistory(h => {
      idxRef.current = h.length;
      return [...h, entry];
    });

    fetch("/api/ssh-parc/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    }).then(res => {
      const idx = idxRef.current;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const read = () => reader.read().then(({ done, value }) => {
        if (done) {
          setHistory(h => h.map((e, i) => i === idx ? { ...e, running: false } : e));
          return;
        }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "start") {
              setHistory(h => h.map((e, i) => i === idx ? { ...e, total: msg.total } : e));
            } else if (msg.type === "result") {
              setHistory(h => h.map((e, i) => i === idx ? { ...e, results: [...e.results, msg] } : e));
            } else if (msg.type === "done") {
              setHistory(h => h.map((e, i) => i === idx ? { ...e, running: false } : e));
            }
          } catch {}
        }
        read();
      });
      read();
    }).catch(err => {
      const idx = idxRef.current;
      setHistory(h => h.map((e, i) => i === idx ? { ...e, running: false, error: String(err) } : e));
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { runCommand(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      setInput(cmdHistory[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? "" : cmdHistory[next] ?? "");
    }
  };

  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      marginTop: 24,
      overflow: "hidden",
    }}>
      {/* Header terminal */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px",
        background: "#050e05",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
          BROADCAST TERMINAL
        </span>
        <span style={{ color: C.gray, fontFamily: mono, fontSize: 10 }}>
          — {docs.length} machine{docs.length !== 1 ? "s" : ""}
        </span>
        <span style={{
          marginLeft: "auto", color: C.greenFaint, fontFamily: mono, fontSize: 9,
        }}>
          ↑↓ historique · Entrée pour exécuter
        </span>
      </div>

      {/* Sortie */}
      <div
        ref={outputRef}
        style={{
          height: 380, overflowY: "auto",
          padding: "12px 16px",
          fontFamily: mono, fontSize: 11,
        }}
      >
        {history.length === 0 && (
          <span style={{ color: C.greenFaint }}>
            {">"} Tape une commande pour l'exécuter sur tous les PCs...
          </span>
        )}
        {history.map((entry, ei) => (
          <div key={ei} style={{ marginBottom: 16 }}>
            {/* Commande lancée */}
            <div style={{ color: C.green, marginBottom: 4 }}>
              <span style={{ color: C.gray }}>$</span>{" "}
              <span style={{ color: C.green }}>{entry.cmd}</span>
              <span style={{ color: C.gray, fontSize: 9, marginLeft: 12 }}>
                {new Date(entry.ts).toLocaleTimeString("fr-FR")}
                {entry.total > 0 && ` · ${entry.results.length}/${entry.total}`}
                {entry.running && <span style={{ color: C.yellow }}> ↻ en cours…</span>}
              </span>
            </div>
            {entry.error && (
              <div style={{ color: C.red, paddingLeft: 12 }}>✗ {entry.error}</div>
            )}
            {/* Résultats par PC */}
            {entry.results.map((r, ri) => (
              <div key={ri} style={{
                marginBottom: 6,
                paddingLeft: 12,
                borderLeft: `2px solid ${r.exit_code === 0 ? C.greenFaint : "rgba(255,51,51,0.3)"}`,
              }}>
                {/* Host header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ color: C.cyan, fontWeight: 700 }}>{r.hostname}</span>
                  <span style={{ color: C.gray, fontSize: 9 }}>{r.ip}</span>
                  <span style={{
                    fontSize: 9,
                    color: r.exit_code === 0 ? C.green : C.red,
                    border: `1px solid ${r.exit_code === 0 ? C.greenFaint : "rgba(255,51,51,0.3)"}`,
                    borderRadius: 2, padding: "0 4px",
                  }}>
                    exit {r.exit_code}
                  </span>
                </div>
                {/* stdout */}
                {r.stdout && (
                  <pre style={{
                    margin: 0, color: C.white, fontSize: 11,
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                    background: "rgba(0,255,65,0.03)",
                    padding: "3px 6px", borderRadius: 3,
                  }}>{r.stdout}</pre>
                )}
                {/* stderr */}
                {r.stderr && (
                  <pre style={{
                    margin: 0, color: C.red, fontSize: 11,
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                    padding: "3px 6px",
                  }}>{r.stderr}</pre>
                )}
                {!r.stdout && !r.stderr && (
                  <span style={{ color: C.gray, fontSize: 10 }}>(aucune sortie)</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        borderTop: `1px solid ${C.border}`,
        background: "#050e05",
      }}>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 13 }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="commande à exécuter sur tous les PCs…"
          autoFocus
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.green,
            fontFamily: mono,
            fontSize: 13,
            caretColor: C.green,
          }}
        />
        <button
          onClick={runCommand}
          disabled={!input.trim()}
          style={{
            background: input.trim() ? C.greenFaint : "none",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: input.trim() ? C.green : C.gray,
            fontFamily: mono,
            fontSize: 10,
            padding: "4px 12px",
            cursor: input.trim() ? "pointer" : "default",
          }}
        >
          ▶ exec
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SshParcPage() {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(() => {
    fetchSshParc()
      .then(r => { setDocs(r.data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleDelete = (id) => {
    deleteSshEntry(id).then(load).catch(e => setError(e.message));
  };

  const handleClearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    clearSshParc()
      .then(() => { setDocs([]); setConfirmClear(false); })
      .catch(e => setError(e.message))
      .finally(() => setClearing(false));
  };

  const filtered = filter
    ? docs.filter(d =>
        [d.hostname, d.ip, d.username, d.ssh_connection_string, d.os]
          .join(" ").toLowerCase().includes(filter.toLowerCase())
      )
    : docs;

  const osCount = {};
  docs.forEach(d => { osCount[d.os || "Inconnu"] = (osCount[d.os || "Inconnu"] || 0) + 1; });

  return (
    <div style={{ background: C.bg, minHeight: "100%", position: "relative" }}>
      <Scanlines />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 32px", maxWidth: 1400 }}>

        {/* ASCII Header */}
        <div style={{ marginBottom: 20, overflow: "hidden" }}>
          <pre style={{
            fontFamily: mono, fontSize: 7, lineHeight: 1.15,
            color: C.greenDim, margin: 0,
            textShadow: "0 0 10px #00ff4144",
          }}>
            {ASCII}
          </pre>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.gray }}>
              PARC PC — INVENTAIRE SSH TEMPS-RÉEL
            </span>
            <span style={{
              fontFamily: mono, fontSize: 10, color: C.green,
              border: `1px solid ${C.greenFaint}`, borderRadius: 3,
              padding: "1px 8px",
            }}>
              {docs.length} machine{docs.length !== 1 ? "s" : ""} enregistrée{docs.length !== 1 ? "s" : ""}
            </span>
            <span style={{
              fontFamily: mono, fontSize: 10, color: C.gray,
              animation: "none",
            }}>
              ↻ auto-refresh 15s
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="PCs connectés" value={docs.length} />
          <StatCard
            label="En ligne"
            value={docs.filter(d => d.timestamp && (Date.now() - new Date(d.timestamp).getTime()) < 300000).length}
            color={C.green}
            sub="< 5 min"
          />
          {Object.entries(osCount).map(([os, n]) => (
            <StatCard key={os} label={os} value={n} color={C.cyan} />
          ))}
        </div>

        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          padding: "10px 14px",
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
        }}>
          {/* Filter */}
          <span style={{ color: C.gray, fontFamily: mono, fontSize: 11 }}>$</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="grep hostname / ip / user…"
            style={{
              flex: 1, maxWidth: 340,
              background: "rgba(0,255,65,.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: "6px 12px",
              color: C.green,
              fontFamily: mono,
              fontSize: 12,
              outline: "none",
              caretColor: C.green,
            }}
          />

          <span style={{ color: C.gray, fontFamily: mono, fontSize: 10 }}>
            {filtered.length}/{docs.length}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {/* Refresh */}
            <button
              onClick={load}
              style={{
                background: "none",
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.grayLight,
                fontFamily: mono,
                fontSize: 10,
                padding: "5px 14px",
                cursor: "pointer",
              }}
            >
              ↻ refresh
            </button>

            {/* Clear all */}
            <button
              onClick={handleClearAll}
              onMouseLeave={() => setConfirmClear(false)}
              disabled={clearing || docs.length === 0}
              style={{
                background: confirmClear ? "rgba(255,51,51,.12)" : "none",
                border: `1px solid ${confirmClear ? C.red : C.greenFaint}`,
                borderRadius: 4,
                color: confirmClear ? C.red : C.gray,
                fontFamily: mono,
                fontSize: 10,
                padding: "5px 14px",
                cursor: "pointer",
                opacity: docs.length === 0 ? 0.4 : 1,
              }}
            >
              {confirmClear ? "⚠ confirmer purge" : "purger tout"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: mono, fontSize: 12, color: C.red,
            background: "rgba(255,51,51,.08)",
            border: `1px solid rgba(255,51,51,.3)`,
            borderRadius: 6, padding: "10px 16px", marginBottom: 16,
          }}>
            ✗ {error}
          </div>
        )}

        {/* Table */}
        <div style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}>
          {loading ? (
            <div style={{
              padding: "60px 0", textAlign: "center",
              fontFamily: mono, fontSize: 13, color: C.greenDim,
            }}>
              <span style={{ animation: "pulse 1s infinite" }}>initializing...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: "60px 0", textAlign: "center",
              fontFamily: mono, color: C.greenFaint, fontSize: 13,
            }}>
              {docs.length === 0
                ? "> aucun PC enregistré — lancez le script d'inventaire SSH sur chaque machine"
                : "> aucun résultat pour ce filtre"}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#050e05", borderBottom: `1px solid ${C.border}` }}>
                  {["", "HOSTNAME", "IP", "USER", "OS", "SSH COMMAND", "LAST SEEN", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "9px 14px",
                      fontFamily: mono, fontSize: 9,
                      color: C.gray, textAlign: "left",
                      letterSpacing: 1.5, fontWeight: 600,
                      textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr key={doc._id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid #0d1a0d` : "none" }}>
                    <PcRowCells doc={doc} onDelete={handleDelete} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Terminal broadcast */}
        <BroadcastTerminal docs={docs} />

        {/* Footer */}
        <div style={{
          marginTop: 20, fontFamily: mono, fontSize: 10, color: C.greenFaint,
          borderTop: `1px solid ${C.border}`, paddingTop: 12,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>mongodb://physical_data/orchestrator_ssh</span>
          <span>SSH WORM v1.0 — {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}

// Séparation pour éviter la collision de hooks dans le tbody map
function PcRowCells({ doc, onDelete }) {
  const [hov, setHov] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const isRecent = doc.timestamp && (Date.now() - new Date(doc.timestamp).getTime()) < 300000;

  return (
    <>
      {/* Status dot */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 14px", width: 28, background: hov ? C.bgRowHov : C.bgRow }}
      >
        <GlowDot color={isRecent ? C.green : C.gray} />
      </td>

      {/* Hostname */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 0", fontFamily: mono, fontSize: 12, color: C.green, fontWeight: 700, background: hov ? C.bgRowHov : C.bgRow }}
      >
        {doc.hostname || "—"}
      </td>

      {/* IP */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 16px", fontFamily: mono, fontSize: 12, color: C.cyan, background: hov ? C.bgRowHov : C.bgRow }}
      >
        {doc.ip || "—"}
      </td>

      {/* Username */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 16px", fontFamily: mono, fontSize: 11, color: C.grayLight, background: hov ? C.bgRowHov : C.bgRow }}
      >
        {doc.username || "—"}
      </td>

      {/* OS */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 16px", fontFamily: mono, fontSize: 10, color: C.gray, background: hov ? C.bgRowHov : C.bgRow }}
      >
        {doc.os || "—"}{doc.os_release ? ` (${doc.os_release})` : ""}
      </td>

      {/* SSH command */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 16px", background: hov ? C.bgRowHov : C.bgRow }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 11, color: C.greenDim,
            background: C.greenFaint, borderRadius: 3,
            padding: "2px 8px", letterSpacing: 0.3,
          }}>
            {doc.ssh_connection_string || "—"}
          </span>
          {doc.ssh_connection_string && <CopyBtn text={doc.ssh_connection_string} />}
        </div>
      </td>

      {/* Last seen */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 16px", fontFamily: mono, fontSize: 10, color: C.gray, whiteSpace: "nowrap", background: hov ? C.bgRowHov : C.bgRow }}
      >
        <span title={fmtTs(doc.timestamp)}>{since(doc.timestamp)}</span>
      </td>

      {/* Delete */}
      <td
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => { setHov(false); setConfirm(false); }}
        style={{ padding: "10px 14px", textAlign: "right", background: hov ? C.bgRowHov : C.bgRow }}
      >
        <button
          onClick={() => { if (!confirm) { setConfirm(true); } else { onDelete(doc._id); } }}
          style={{
            background: confirm ? "rgba(255,51,51,.15)" : "none",
            border: `1px solid ${confirm ? C.red : C.greenFaint}`,
            borderRadius: 3,
            color: confirm ? C.red : C.gray,
            fontSize: 9,
            fontFamily: mono,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          {confirm ? "confirmer" : "retirer"}
        </button>
      </td>
    </>
  );
}
