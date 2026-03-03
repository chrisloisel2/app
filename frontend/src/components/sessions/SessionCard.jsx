import { Link } from "react-router-dom";

function compactValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? `${v}` : v.toFixed(2);
  if (Array.isArray(v)) {
    const preview = v.slice(0, 2).map((x) => (typeof x === "object" ? "{...}" : String(x)));
    const suffix = v.length > 2 ? ` +${v.length - 2}` : "";
    return preview.length ? `${preview.join(", ")}${suffix}` : "array(0)";
  }
  if (typeof v === "object") {
    const entries = Object.entries(v);
    const preview = entries.slice(0, 2).map(([k, val]) => {
      if (val === null || val === undefined) return `${k}: —`;
      if (typeof val === "object") {
        if (Array.isArray(val)) return `${k}[${val.length}]`;
        return `${k}{${Object.keys(val).length}}`;
      }
      const s = String(val);
      return `${k}: ${s.length > 14 ? `${s.slice(0, 14)}...` : s}`;
    });
    const suffix = entries.length > 2 ? ` +${entries.length - 2}` : "";
    return preview.length ? `${preview.join(" | ")}${suffix}` : "object(0)";
  }
  const s = String(v);
  return s.length > 22 ? `${s.slice(0, 22)}...` : s;
}

function renderNestedObjectCards(obj) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) {
    return <p className="text-xs font-mono text-gray-700">—</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-1 mt-1">
      {entries.map(([subKey, subVal]) => (
        <div key={subKey} className="rounded border border-gray-200 bg-white px-1.5 py-1">
          <p className="text-[10px] font-semibold text-gray-600 font-mono">{subKey}</p>
          <p className="text-[10px] text-gray-500 font-mono break-words">
            {typeof subVal === "object" && subVal !== null
              ? Object.entries(subVal)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" ")
              : compactValue(subVal)}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderMetadataValue(key, value) {
  if (key === "video_config" && value && typeof value === "object") {
    const video = value;
    return (
      <div className="grid grid-cols-3 gap-1 mt-1">
        <div className="rounded border border-gray-200 bg-white px-1.5 py-1">
          <p className="text-[10px] text-gray-500">W</p>
          <p className="text-[10px] font-mono text-gray-700">{video.width ?? "—"}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white px-1.5 py-1">
          <p className="text-[10px] text-gray-500">H</p>
          <p className="text-[10px] font-mono text-gray-700">{video.height ?? "—"}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white px-1.5 py-1">
          <p className="text-[10px] text-gray-500">FPS</p>
          <p className="text-[10px] font-mono text-gray-700">{video.fps ?? "—"}</p>
        </div>
      </div>
    );
  }

  if ((key === "pinces" || key === "trackers") && value && typeof value === "object") {
    return renderNestedObjectCards(value);
  }

  return <p className="text-xs font-mono text-gray-700 break-words">{compactValue(value)}</p>;
}

export default function SessionCard({ session }) {
  const { session_id, frame_count, start_time, metadata } = session;

  // "session_20260222_175519" -> "22/02/2026  17:55:19"
  const raw = session_id.replace("session_", "");
  const d   = raw.slice(0, 8);
  const t   = raw.slice(9);
  const dateLabel = `${d.slice(6)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
  const timeLabel = `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4)}`;
  const metadataEntries = metadata ? Object.entries(metadata) : [];
  const priority = ["video_config", "pinces", "trackers"];
  const orderedMetadataEntries = [
    ...metadataEntries.filter(([k]) => priority.includes(k)),
    ...metadataEntries.filter(([k]) => !priority.includes(k)),
  ];
  const previewEntries = orderedMetadataEntries.slice(0, 4);

  return (
    <Link to={`/sessions/${session_id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm
                      hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group">
        <p className="text-xs font-mono text-gray-400 truncate">{session_id}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-base font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
            {dateLabel}
          </span>
          <span className="text-sm text-gray-400">{timeLabel}</span>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{frame_count?.toLocaleString()}</span> frames
          </span>
        </div>
        {start_time && (
          <p className="mt-2 text-xs text-gray-400 truncate">
            {start_time?.slice(0, 19).replace("T", " ")}
          </p>
        )}

        <div className="mt-3 space-y-2">
          {previewEntries.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {previewEntries.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 truncate">{k}</p>
                  {renderMetadataValue(k, v)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Pas de metadata.json</p>
          )}

          {metadataEntries.length > previewEntries.length && (
            <p className="text-[11px] text-gray-400">
              +{metadataEntries.length - previewEntries.length} autres champs
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
