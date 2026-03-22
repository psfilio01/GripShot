"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";

interface HumanModelRow {
  id: string;
  displayName: string;
  notes: string;
}

export default function HumanModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<HumanModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function load() {
    const res = await fetch("/api/human-models");
    if (res.ok) {
      const data = await res.json();
      setModels(data.models ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/human-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), notes: notes.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        toast("Model created — add reference photos next", "success");
        setName("");
        setNotes("");
        await load();
        router.push(`/dashboard/human-models/${data.modelId}`);
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Create failed", "error");
      }
    } catch {
      toast("Create failed", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Human models
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Upload reference photos for each talent. Amazon lifestyle shots use
          these so the generated person matches your chosen model (or a random
          one from your list).
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="gs-card-static p-6 space-y-4"
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--gs-text-secondary)" }}
        >
          New model
        </h2>
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Studio model A"
            className="gs-input block w-full px-3 py-2 text-sm"
            maxLength={120}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hair, build, usage rights reminder…"
            className="gs-input block w-full px-3 py-2 text-sm"
            maxLength={500}
          />
        </div>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="gs-btn-primary px-4 py-2 text-sm"
        >
          {creating ? "Creating…" : "Create & upload references"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
          Loading…
        </p>
      ) : models.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No models yet"
          description="Create a model and add 1–3 clear reference photos (face + body) for best lifestyle results."
        />
      ) : (
        <ul className="space-y-2">
          {models.map((m) => (
            <li key={m.id}>
              <Link
                href={`/dashboard/human-models/${encodeURIComponent(m.id)}`}
                className="gs-card-static flex items-center justify-between p-4 transition hover:opacity-95"
                style={{ borderColor: "var(--gs-border)" }}
              >
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "var(--gs-text)" }}
                  >
                    {m.displayName}
                  </p>
                  {m.notes ? (
                    <p
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: "var(--gs-text-muted)" }}
                    >
                      {m.notes}
                    </p>
                  ) : null}
                  <p
                    className="text-[10px] mt-1 font-mono"
                    style={{ color: "var(--gs-text-faint)" }}
                  >
                    {m.id.slice(0, 12)}…
                  </p>
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--gs-accent-text)" }}
                >
                  Manage →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
