"use client";

import { useEffect, useState, type FormEvent, useCallback, useRef } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";

interface BackgroundRow {
  id: string;
  name: string;
  type: "canvas" | "freestyle" | "upload";
  description: string;
  previewUrl?: string | null;
}

type Tab = "canvas" | "freestyle" | "upload";

export default function BackgroundsPage() {
  const [backgrounds, setBackgrounds] = useState<BackgroundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("canvas");
  const { toast } = useToast();

  // Canvas form
  const [canvasName, setCanvasName] = useState("");
  const [canvasDesc, setCanvasDesc] = useState("");
  const [canvasGenerating, setCanvasGenerating] = useState(false);

  // Freestyle form
  const [freeName, setFreeName] = useState("");
  const [freeDesc, setFreeDesc] = useState("");
  const [freeGenerating, setFreeGenerating] = useState(false);

  // Upload form
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/backgrounds");
    if (res.ok) {
      const data = await res.json();
      setBackgrounds(data.backgrounds ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCanvasCreate(e: FormEvent) {
    e.preventDefault();
    if (!canvasName.trim() || !canvasDesc.trim()) return;
    setCanvasGenerating(true);
    try {
      const createRes = await fetch("/api/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: canvasName.trim(),
          type: "canvas",
          description: canvasDesc.trim(),
        }),
      });
      if (!createRes.ok) throw new Error("Create failed");
      const { backgroundId } = await createRes.json();

      const genRes = await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundId,
          type: "canvas",
          description: canvasDesc.trim(),
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => null);
        throw new Error(err?.error ?? "Generation failed");
      }
      toast("Canvas background generated", "success");
      setCanvasName("");
      setCanvasDesc("");
      await load();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Generation failed",
        "error",
      );
    } finally {
      setCanvasGenerating(false);
    }
  }

  async function handleFreestyleCreate(e: FormEvent) {
    e.preventDefault();
    if (!freeName.trim() || !freeDesc.trim()) return;
    setFreeGenerating(true);
    try {
      const createRes = await fetch("/api/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: freeName.trim(),
          type: "freestyle",
          description: freeDesc.trim(),
        }),
      });
      if (!createRes.ok) throw new Error("Create failed");
      const { backgroundId } = await createRes.json();

      const genRes = await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundId,
          type: "freestyle",
          description: freeDesc.trim(),
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => null);
        throw new Error(err?.error ?? "Generation failed");
      }
      toast("Freestyle background generated", "success");
      setFreeName("");
      setFreeDesc("");
      await load();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Generation failed",
        "error",
      );
    } finally {
      setFreeGenerating(false);
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!uploadName.trim() || !uploadFile) return;
    setUploading(true);
    try {
      const createRes = await fetch("/api/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName.trim(),
          type: "upload",
          description: uploadDesc.trim(),
        }),
      });
      if (!createRes.ok) throw new Error("Create failed");
      const { backgroundId } = await createRes.json();

      const formData = new FormData();
      formData.append("file", uploadFile);
      const uploadRes = await fetch(
        `/api/backgrounds/${backgroundId}/upload`,
        { method: "POST", body: formData },
      );
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        throw new Error(err?.error ?? "Upload failed");
      }
      toast("Background uploaded", "success");
      setUploadName("");
      setUploadDesc("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Upload failed",
        "error",
      );
    } finally {
      setUploading(false);
    }
  }

  const tabLabels: Record<Tab, string> = {
    canvas: "Canvas",
    freestyle: "Freestyle",
    upload: "Upload",
  };

  return (
    <div className="max-w-4xl space-y-8 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Backgrounds
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Create backgrounds for your product shots. Choose from AI-generated
          canvases, freestyle scenes, or upload your own.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 rounded-lg p-1"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {(["canvas", "freestyle", "upload"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition"
            style={{
              background: tab === t ? "var(--gs-surface)" : "transparent",
              color: tab === t ? "var(--gs-text)" : "var(--gs-text-muted)",
              boxShadow: tab === t ? "var(--gs-shadow-sm)" : "none",
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Canvas form */}
      {tab === "canvas" && (
        <form
          onSubmit={handleCanvasCreate}
          className="gs-card-static p-6 space-y-4"
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Photo canvas
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Generate a studio backdrop – solid colors, gradients, patterns,
            textures, or any combination. Or upload your own below.
          </p>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Name
            </label>
            <input
              type="text"
              value={canvasName}
              onChange={(e) => setCanvasName(e.target.value)}
              placeholder="e.g. Golden gradient"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Description
            </label>
            <textarea
              value={canvasDesc}
              onChange={(e) => setCanvasDesc(e.target.value)}
              placeholder="Describe the backdrop: colors, gradients, patterns, texture…"
              className="gs-input block w-full px-3 py-2 text-sm min-h-[60px]"
              maxLength={2000}
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={
              canvasGenerating || !canvasName.trim() || !canvasDesc.trim()
            }
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {canvasGenerating
              ? "Generating with Gemini…"
              : "Generate canvas background"}
          </button>
          {canvasGenerating && (
            <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
              This may take 30–60 seconds…
            </p>
          )}
        </form>
      )}

      {/* Freestyle form */}
      {tab === "freestyle" && (
        <form
          onSubmit={handleFreestyleCreate}
          className="gs-card-static p-6 space-y-4"
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Freestyle scene
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Describe a scene – beach, loft apartment, mountains, garden, etc.
            The AI generates a background without people (unless you specify
            otherwise). Or upload your own below.
          </p>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Name
            </label>
            <input
              type="text"
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              placeholder="e.g. Tropical beach sunset"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Scene description
            </label>
            <textarea
              value={freeDesc}
              onChange={(e) => setFreeDesc(e.target.value)}
              placeholder="Describe the scene in detail…"
              className="gs-input block w-full px-3 py-2 text-sm min-h-[60px]"
              maxLength={2000}
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={
              freeGenerating || !freeName.trim() || !freeDesc.trim()
            }
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {freeGenerating
              ? "Generating with Gemini…"
              : "Generate freestyle background"}
          </button>
          {freeGenerating && (
            <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
              This may take 30–60 seconds…
            </p>
          )}
        </form>
      )}

      {/* Upload form */}
      {tab === "upload" && (
        <form
          onSubmit={handleUpload}
          className="gs-card-static p-6 space-y-4"
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Upload background
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Upload your own background image (JPEG, PNG, or WebP, max 10 MB).
          </p>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Name
            </label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Golden studio backdrop"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={120}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Description (optional)
            </label>
            <input
              type="text"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Brief description…"
              className="gs-input block w-full px-3 py-2 text-sm"
              maxLength={500}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Image file
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="gs-input block w-full px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !uploadName.trim() || !uploadFile}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {uploading ? "Uploading…" : "Upload background"}
          </button>
        </form>
      )}

      {/* Backgrounds list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
          Loading…
        </p>
      ) : backgrounds.length === 0 ? (
        <EmptyState
          icon="🖼️"
          title="No backgrounds yet"
          description="Create a canvas, freestyle scene, or upload your own background image."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {backgrounds.map((bg) => (
            <Link
              key={bg.id}
              href={`/dashboard/backgrounds/${encodeURIComponent(bg.id)}`}
              className="gs-card-static overflow-hidden transition hover:opacity-95"
              style={{ borderColor: "var(--gs-border)" }}
            >
              <div
                className="aspect-[4/3] flex items-center justify-center overflow-hidden"
                style={{ background: "var(--gs-surface-inset)" }}
              >
                {bg.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={bg.previewUrl}
                    alt={bg.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="text-3xl"
                    style={{ color: "var(--gs-text-faint)" }}
                  >
                    🖼️
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <p
                    className="font-semibold text-sm truncate flex-1"
                    style={{ color: "var(--gs-text)" }}
                  >
                    {bg.name}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                    style={{
                      background: "var(--gs-surface-inset)",
                      color: "var(--gs-text-muted)",
                    }}
                  >
                    {bg.type}
                  </span>
                </div>
                {bg.description && (
                  <p
                    className="text-xs mt-1 line-clamp-1"
                    style={{ color: "var(--gs-text-muted)" }}
                  >
                    {bg.description}
                  </p>
                )}
                <p
                  className="text-xs font-medium mt-2"
                  style={{ color: "var(--gs-accent-text)" }}
                >
                  Manage →
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
