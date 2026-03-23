"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface BackgroundData {
  id: string;
  name: string;
  type: "canvas" | "freestyle" | "upload";
  description: string;
}

export default function BackgroundDetailPage() {
  const { backgroundId } = useParams<{ backgroundId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bg, setBg] = useState<BackgroundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/backgrounds/${backgroundId}`);
    if (res.ok) {
      const data = await res.json();
      setBg(data);
      setEditName(data.name);
      setEditDesc(data.description);
    }
    setLoading(false);
  }, [backgroundId]);

  const loadPreview = useCallback(async () => {
    const res = await fetch("/api/backgrounds");
    if (res.ok) {
      const data = await res.json();
      const match = data.backgrounds?.find(
        (b: { id: string }) => b.id === backgroundId,
      );
      if (match?.previewUrl) setPreviewUrl(match.previewUrl);
    }
  }, [backgroundId]);

  useEffect(() => {
    load();
    loadPreview();
  }, [load, loadPreview]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/backgrounds/${backgroundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      if (res.ok) {
        toast("Changes saved", "success");
        setEditing(false);
        await load();
      } else {
        toast("Save failed", "error");
      }
    } catch {
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/backgrounds/${backgroundId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast("Background deleted", "success");
      router.push("/dashboard/backgrounds");
    } else {
      toast("Delete failed", "error");
    }
  }

  async function handleRegenerate() {
    if (!bg) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundId,
          type: bg.type === "upload" ? "freestyle" : bg.type,
          description: bg.description,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url + "?t=" + Date.now());
        toast("Background regenerated", "success");
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Regeneration failed", "error");
      }
    } catch {
      toast("Regeneration failed", "error");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleUploadNew(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/backgrounds/${backgroundId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url + "?t=" + Date.now());
        toast("Image uploaded", "success");
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Upload failed", "error");
      }
    } catch {
      toast("Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
        Loading…
      </p>
    );
  }

  if (!bg) {
    return (
      <p className="text-sm" style={{ color: "var(--gs-error-text)" }}>
        Background not found.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 gs-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard/backgrounds"
          className="font-medium"
          style={{ color: "var(--gs-accent-text)" }}
        >
          Backgrounds
        </Link>
        <span style={{ color: "var(--gs-text-faint)" }}>/</span>
        <span style={{ color: "var(--gs-text-muted)" }}>{bg.name}</span>
      </nav>

      {/* Preview */}
      <div
        className="gs-card-static overflow-hidden"
        style={{ borderColor: "var(--gs-border)" }}
      >
        <div
          className="aspect-[4/3] flex items-center justify-center overflow-hidden"
          style={{ background: "var(--gs-surface-inset)" }}
        >
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt={bg.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="text-5xl"
              style={{ color: "var(--gs-text-faint)" }}
            >
              🖼️
            </span>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        {bg.type !== "upload" && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="gs-btn-secondary px-3 py-1.5 text-sm"
          >
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
        <label className="gs-btn-secondary px-3 py-1.5 text-sm cursor-pointer">
          {uploading ? "Uploading…" : "Upload new image"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadNew(f);
            }}
          />
        </label>
      </div>

      {/* Details card */}
      <div className="gs-card-static p-6 space-y-4">
        {editing ? (
          <>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
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
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm min-h-[60px]"
                maxLength={2000}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="gs-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditName(bg.name);
                  setEditDesc(bg.description);
                }}
                className="gs-btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-lg font-semibold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {bg.name}
                </p>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{
                    background: "var(--gs-surface-inset)",
                    color: "var(--gs-text-muted)",
                  }}
                >
                  {bg.type}
                </span>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="gs-btn-secondary px-3 py-1.5 text-sm"
              >
                Edit
              </button>
            </div>
            {bg.description && (
              <p className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
                {bg.description}
              </p>
            )}
          </>
        )}

        <div
          className="pt-4"
          style={{ borderTop: "1px solid var(--gs-border-subtle)" }}
        >
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-medium"
            style={{ color: "var(--gs-error-text)" }}
          >
            Delete background
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete background?"
        message="This will permanently remove this background and its image."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
