"use client";

import { useEffect, useState, useCallback } from "react";

type LogType = "image" | "listing-copy" | "aplus" | "background" | "human-model";

interface GenerationLog {
  id: string;
  type: LogType;
  workspaceId: string;
  userId: string;
  userEmail: string;
  prompt: string;
  promptPreview: string;
  input: Record<string, unknown>;
  model?: string;
  referenceImageCount?: number;
  aspectRatio?: string;
  resolution?: string;
  durationMs?: number;
  status: "started" | "completed" | "failed";
  errorMessage?: string;
  createdAt: { _seconds: number } | null;
}

const TYPE_LABELS: Record<LogType, string> = {
  image: "Product Image",
  "listing-copy": "Listing Copy",
  aplus: "A+ Content",
  background: "Background",
  "human-model": "Human Model",
};

const TYPE_COLORS: Record<LogType, string> = {
  image: "var(--gs-accent)",
  "listing-copy": "#8b5cf6",
  aplus: "#f59e0b",
  background: "#10b981",
  "human-model": "#ec4899",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  started: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
  completed: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981" },
  failed: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
};

function formatTimestamp(ts: { _seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts._seconds * 1000).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<LogType | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullLog, setFullLog] = useState<GenerationLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/generation-logs?${params}`);
      if (res.status === 403) {
        setError("Access denied. Admin privileges required.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const loadFullLog = async (logId: string) => {
    if (expandedId === logId) {
      setExpandedId(null);
      setFullLog(null);
      return;
    }
    setExpandedId(logId);
    try {
      const res = await fetch(`/api/admin/generation-logs/${logId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFullLog(data.log);
    } catch {
      setFullLog(null);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--gs-text)" }}
        >
          Generation Logs
        </h1>
        <div
          className="rounded-lg p-6 text-center"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--gs-text)" }}
          >
            Generation Logs
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--gs-text-muted)" }}
          >
            Full prompt history and generation pipeline details
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as LogType | "")}
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--gs-surface)",
              color: "var(--gs-text)",
              border: "1px solid var(--gs-border-subtle)",
            }}
          >
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <button
            onClick={fetchLogs}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--gs-accent)",
              color: "white",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--gs-text-muted)" }}
        >
          Loading generation logs...
        </div>
      ) : logs.length === 0 ? (
        <div
          className="rounded-lg p-12 text-center"
          style={{
            background: "var(--gs-surface)",
            border: "1px solid var(--gs-border-subtle)",
          }}
        >
          <p style={{ color: "var(--gs-text-muted)" }}>
            No generation logs found.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg overflow-hidden"
              style={{
                background: "var(--gs-surface)",
                border: "1px solid var(--gs-border-subtle)",
              }}
            >
              {/* Log row */}
              <button
                onClick={() => loadFullLog(entry.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-4"
                style={{ cursor: "pointer" }}
              >
                {/* Type badge */}
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: `color-mix(in srgb, ${TYPE_COLORS[entry.type]} 15%, transparent)`,
                    color: TYPE_COLORS[entry.type],
                  }}
                >
                  {TYPE_LABELS[entry.type]}
                </span>

                {/* Status */}
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: STATUS_STYLES[entry.status]?.bg ?? "transparent",
                    color: STATUS_STYLES[entry.status]?.text ?? "inherit",
                  }}
                >
                  {entry.status}
                </span>

                {/* Prompt preview */}
                <span
                  className="flex-1 truncate text-sm"
                  style={{ color: "var(--gs-text)" }}
                >
                  {entry.promptPreview}
                </span>

                {/* Meta */}
                <span
                  className="shrink-0 text-xs tabular-nums"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {formatDuration(entry.durationMs)}
                </span>
                {entry.model && (
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: "var(--gs-text-muted)" }}
                  >
                    {entry.model}
                  </span>
                )}
                <span
                  className="shrink-0 text-xs tabular-nums"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {formatTimestamp(entry.createdAt)}
                </span>

                {/* Expand arrow */}
                <svg
                  className="h-4 w-4 shrink-0 transition-transform"
                  style={{
                    color: "var(--gs-text-muted)",
                    transform:
                      expandedId === entry.id ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>

              {/* Expanded detail */}
              {expandedId === entry.id && fullLog && (
                <div
                  className="px-4 pb-4 space-y-4"
                  style={{
                    borderTop: "1px solid var(--gs-border-subtle)",
                  }}
                >
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                    <MetaField label="User" value={fullLog.userEmail} />
                    <MetaField label="Workspace" value={fullLog.workspaceId} />
                    <MetaField label="Model" value={fullLog.model ?? "—"} />
                    <MetaField
                      label="Duration"
                      value={formatDuration(fullLog.durationMs)}
                    />
                    {fullLog.aspectRatio && (
                      <MetaField
                        label="Aspect Ratio"
                        value={fullLog.aspectRatio}
                      />
                    )}
                    {fullLog.resolution && (
                      <MetaField
                        label="Resolution"
                        value={fullLog.resolution}
                      />
                    )}
                    {fullLog.referenceImageCount != null && (
                      <MetaField
                        label="Reference Images"
                        value={String(fullLog.referenceImageCount)}
                      />
                    )}
                  </div>

                  {/* Input params */}
                  {fullLog.input &&
                    Object.keys(fullLog.input).length > 0 && (
                      <div>
                        <h4
                          className="text-xs font-semibold uppercase tracking-wider mb-2"
                          style={{ color: "var(--gs-text-muted)" }}
                        >
                          Input Parameters
                        </h4>
                        <pre
                          className="rounded-lg p-3 text-xs overflow-x-auto"
                          style={{
                            background: "var(--gs-bg)",
                            color: "var(--gs-text)",
                            border: "1px solid var(--gs-border-subtle)",
                          }}
                        >
                          {JSON.stringify(fullLog.input, null, 2)}
                        </pre>
                      </div>
                    )}

                  {/* Full prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--gs-text-muted)" }}
                      >
                        Full Prompt
                      </h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(fullLog.prompt);
                        }}
                        className="rounded px-2 py-1 text-xs"
                        style={{
                          background: "var(--gs-bg)",
                          color: "var(--gs-text-muted)",
                          border: "1px solid var(--gs-border-subtle)",
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <pre
                      className="rounded-lg p-4 text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed"
                      style={{
                        background: "var(--gs-bg)",
                        color: "var(--gs-text)",
                        border: "1px solid var(--gs-border-subtle)",
                        maxHeight: "600px",
                        overflowY: "auto",
                      }}
                    >
                      {fullLog.prompt}
                    </pre>
                  </div>

                  {/* Error message if failed */}
                  {fullLog.errorMessage && (
                    <div>
                      <h4
                        className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: "#ef4444" }}
                      >
                        Error
                      </h4>
                      <pre
                        className="rounded-lg p-3 text-xs"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                        }}
                      >
                        {fullLog.errorMessage}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-xs font-medium"
        style={{ color: "var(--gs-text-muted)" }}
      >
        {label}
      </dt>
      <dd
        className="text-sm mt-0.5 truncate"
        style={{ color: "var(--gs-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}
