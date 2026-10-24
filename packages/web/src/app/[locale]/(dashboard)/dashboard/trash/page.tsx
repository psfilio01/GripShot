"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";

const TRASH_TTL_DAYS = 7;

interface DeletedItem {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  deletedAt: { _seconds: number } | null;
  deletedBy?: string | null;
  /* workflow-specific */
  status?: string;
  /* product-specific */
  category?: string;
  /* model-specific */
  source?: string;
  /* background-specific */
  type?: string;
}

interface TrashData {
  workflows: DeletedItem[];
  products: DeletedItem[];
  models: DeletedItem[];
  backgrounds: DeletedItem[];
}

type TrashType = "workflows" | "products" | "models" | "backgrounds";

function purgeDate(deletedAt: { _seconds: number } | null): string {
  if (!deletedAt) return "—";
  const d = new Date((deletedAt._seconds + TRASH_TTL_DAYS * 86400) * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function deletedDate(deletedAt: { _seconds: number } | null): string {
  if (!deletedAt) return "—";
  const d = new Date(deletedAt._seconds * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function itemLabel(item: DeletedItem): string {
  return item.name ?? item.displayName ?? item.id;
}

function itemSub(item: DeletedItem, type: TrashType): string {
  switch (type) {
    case "workflows": return item.status ?? "";
    case "products": return item.category ?? "";
    case "models": return item.source ?? "";
    case "backgrounds": return item.type ?? "";
    default: return "";
  }
}

export default function TrashPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TrashData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const res = await fetch("/api/trash");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast("Failed to load trash", "error");
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(type: TrashType, id: string) {
    const key = `${type}/${id}`;
    setBusy(key);
    try {
      const res = await fetch(`/api/trash/${type}/${id}`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast("Restored successfully", "success");
      await load();
    } catch {
      toast("Restore failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function hardDelete(type: TrashType, id: string, label: string) {
    if (!confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    const key = `${type}/${id}`;
    setBusy(key);
    try {
      const res = await fetch(`/api/trash/${type}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Permanently deleted", "success");
      await load();
    } catch {
      toast("Delete failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const total = data
    ? data.workflows.length + data.products.length + data.models.length + data.backgrounds.length
    : 0;

  const sections: Array<{ key: TrashType; label: string; icon: string }> = [
    { key: "workflows", label: "Workflows", icon: "🔄" },
    { key: "products", label: "Products", icon: "📦" },
    { key: "models", label: "Models", icon: "👤" },
    { key: "backgrounds", label: "Backgrounds", icon: "🖼" },
  ];

  return (
    <div className="space-y-6 gs-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--gs-text)" }}>
          Trash
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Items in trash are automatically deleted after {TRASH_TTL_DAYS} days.
        </p>
      </div>

      {!loaded && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: "var(--gs-surface-inset)" }}
            />
          ))}
        </div>
      )}

      {loaded && total === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "var(--gs-surface-raised)", border: "1px solid var(--gs-border)" }}
        >
          <p className="text-4xl mb-3">🗑️</p>
          <p className="text-base font-semibold" style={{ color: "var(--gs-text)" }}>
            Trash is empty
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
            Deleted items will appear here for {TRASH_TTL_DAYS} days before being permanently removed.
          </p>
        </div>
      )}

      {loaded && data && total > 0 &&
        sections.map(({ key, label, icon }) => {
          const items = data[key];
          if (items.length === 0) return null;
          return (
            <section key={key} className="space-y-2">
              <h2
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--gs-text-muted)" }}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: "var(--gs-surface-inset)",
                    color: "var(--gs-text-muted)",
                  }}
                >
                  {items.length}
                </span>
              </h2>

              <div className="space-y-2">
                {items.map((item) => {
                  const busyKey = `${key}/${item.id}`;
                  const isBusy = busy === busyKey;
                  const label = itemLabel(item);
                  const sub = itemSub(item, key);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                      style={{
                        background: "var(--gs-surface-raised)",
                        border: "1px solid var(--gs-border)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--gs-text)" }}
                        >
                          {label}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {sub && (
                            <span
                              className="text-xs"
                              style={{ color: "var(--gs-text-faint)" }}
                            >
                              {sub}
                            </span>
                          )}
                          <span
                            className="text-xs"
                            style={{ color: "var(--gs-text-faint)" }}
                          >
                            Deleted {deletedDate(item.deletedAt)}
                          </span>
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--gs-warning-text, #d97706)" }}
                          >
                            Auto-deletes {purgeDate(item.deletedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => restore(key, item.id)}
                          disabled={isBusy}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                          style={{
                            background: "var(--gs-surface-inset)",
                            color: "var(--gs-text-secondary)",
                            border: "1px solid var(--gs-border-subtle)",
                            opacity: isBusy ? 0.5 : 1,
                          }}
                        >
                          {isBusy ? "…" : "Restore"}
                        </button>
                        <button
                          onClick={() => hardDelete(key, item.id, label)}
                          disabled={isBusy}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                          style={{
                            background: "var(--gs-error-bg)",
                            color: "var(--gs-error-text)",
                            opacity: isBusy ? 0.5 : 1,
                          }}
                        >
                          Delete forever
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      }
    </div>
  );
}
