import { useEffect, useState, useCallback, useRef } from "react";
import { fetchSshParc } from "../api/client";

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
          height: 520, overflowY: "auto",
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

// ── Sidebar liste des PCs ─────────────────────────────────────────────────────
function PcSidebar({ docs, loading }) {
  const online = (doc) => doc.timestamp && (Date.now() - new Date(doc.timestamp).getTime()) < 300000;

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px",
        borderBottom: `1px solid ${C.border}`,
        background: "#050e05",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
          MACHINES
        </span>
        <span style={{
          marginLeft: "auto",
          fontFamily: mono, fontSize: 9, color: C.gray,
        }}>
          {docs.filter(online).length}/{docs.length} en ligne
        </span>
      </div>

      {/* Liste */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ padding: "20px 12px", fontFamily: mono, fontSize: 10, color: C.greenFaint }}>
            initializing...
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: "20px 12px", fontFamily: mono, fontSize: 10, color: C.greenFaint }}>
            aucun PC enregistré
          </div>
        ) : (
          docs.map((doc, i) => (
            <div key={doc._id} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderBottom: i < docs.length - 1 ? `1px solid #0a160a` : "none",
            }}>
              {/* Pastille */}
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                flexShrink: 0,
                background: online(doc) ? "#00ff41" : "#ff3333",
                boxShadow: online(doc) ? "0 0 6px #00ff4188" : "0 0 6px #ff333388",
              }} />
              {/* Nom */}
              <span style={{
                fontFamily: mono, fontSize: 11, color: C.white,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {doc.hostname || doc.ip || "—"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "6px 12px",
        borderTop: `1px solid ${C.border}`,
        fontFamily: mono, fontSize: 9, color: C.greenFaint,
        background: "#050e05",
      }}>
        ↻ 15s
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SshParcPage() {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
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

  return (
    <div style={{ background: C.bg, minHeight: "100%", position: "relative" }}>
      <Scanlines />

      <div style={{ position: "relative", zIndex: 1, padding: "24px 32px", height: "100%", boxSizing: "border-box" }}>

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

        {/* Layout principal : terminal + sidebar */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Terminal broadcast (zone principale) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <BroadcastTerminal docs={docs} />
          </div>

          {/* Sidebar PCs */}
          <PcSidebar docs={docs} loading={loading} />
        </div>

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

