"use client";

import { useEffect, useState, useCallback, useRef, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ZoomableImage } from "@/components/zoomable-image";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ModelData {
  id: string;
  displayName: string;
  notes: string;
}

interface ImageRow {
  name: string;
  url: string;
  size: number;
  updatedAt: string;
}

export default function HumanModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const router = useRouter();
  const [model, setModel] = useState<ModelData | null | undefined>(undefined);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadModel = useCallback(async () => {
    const res = await fetch(`/api/human-models/${encodeURIComponent(modelId)}`);
    if (!res.ok) {
      setModel(null);
      return;
    }
    const data = await res.json();
    setModel(data.model);
    setEditName(data.model.displayName);
    setEditNotes(data.model.notes ?? "");
  }, [modelId]);

  const loadImages = useCallback(async () => {
    const res = await fetch(
      `/api/human-models/${encodeURIComponent(modelId)}/images`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setImages(data.images ?? []);
  }, [modelId]);

  useEffect(() => {
    loadModel();
    loadImages();
  }, [loadModel, loadImages]);

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of Array.from(files)) formData.append("files", f);
      const res = await fetch(
        `/api/human-models/${encodeURIComponent(modelId)}/images`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        toast("Photos uploaded", "success");
        await loadImages();
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Upload failed", "error");
      }
    } catch {
      toast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(fileName: string) {
    const res = await fetch(
      `/api/human-models/${encodeURIComponent(modelId)}/images?name=${encodeURIComponent(fileName)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast("Photo removed", "success");
      await loadImages();
    }
  }

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        `/api/human-models/${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: editName.trim(),
            notes: editNotes.trim(),
          }),
        },
      );
      if (res.ok) {
        toast("Saved", "success");
        await loadModel();
      }
    } catch {
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteModel() {
    const res = await fetch(
      `/api/human-models/${encodeURIComponent(modelId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast("Model deleted", "success");
      router.push("/dashboard/human-models");
    } else {
      toast("Delete failed", "error");
    }
    setConfirmDelete(false);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (model === undefined) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: "var(--gs-text-faint)" }}>
        Loading…
      </div>
    );
  }

  if (model === null) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: "var(--gs-text-faint)" }}>
        Model not found.{" "}
        <Link href="/dashboard/human-models" className="underline">
          Back to models
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 gs-fade-in">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard/human-models"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Models
        </Link>
        <span style={{ color: "var(--gs-text-faint)" }}>/</span>
        <span style={{ color: "var(--gs-text-secondary)" }}>
          {model.displayName}
        </span>
      </div>

      <form onSubmit={handleSaveMeta} className="gs-card-static p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-[200px]">
            <div>
              <label
                htmlFor="human-model-detail-name"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Display name
              </label>
              <input
                id="human-model-detail-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="human-model-detail-notes"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Notes
              </label>
              <input
                id="human-model-detail-notes"
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={saving || !editName.trim()}
              className="gs-btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Saving…" : "Save details"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                background: "var(--gs-error-bg)",
                color: "var(--gs-error-text)",
              }}
            >
              Delete model
            </button>
          </div>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            Reference photos
          </h2>
          <span className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
            {images.length} file{images.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--gs-text-muted)" }}>
          Stored under{" "}
          <code className="text-[10px] px-1 rounded" style={{ background: "var(--gs-surface-inset)" }}>
            data/models/{modelId}/reference/
          </code>
          . Use 1–3 consistent shots for best results.
        </p>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleUpload(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="gs-btn-secondary px-4 py-2 text-sm"
        >
          {uploading ? "Uploading…" : "Upload photos"}
        </button>

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div key={img.name} className="gs-card group relative overflow-hidden">
                <ZoomableImage
                  src={img.url}
                  alt={img.name}
                  className="aspect-[3/4] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-[10px] text-white truncate">{img.name}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.name)}
                      className="text-[10px] text-red-300 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl p-4 text-sm" style={{ background: "var(--gs-surface-inset)" }}>
        <p style={{ color: "var(--gs-text-secondary)" }}>
          On <strong>Generate</strong>, pick this model for lifestyle shots or use{" "}
          <strong>Random</strong> to rotate among all models in your workspace.
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this model?"
        message="This removes the Firestore record and all reference files on disk. Generated images are not deleted."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteModel}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
