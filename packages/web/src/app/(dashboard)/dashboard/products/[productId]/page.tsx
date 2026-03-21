"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ZoomableImage } from "@/components/zoomable-image";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";

const IMAGE_CATEGORIES = [
  { id: "primary", label: "Primary" },
  { id: "logo", label: "Logo" },
  { id: "packaging", label: "Packaging" },
  { id: "angle", label: "Angle" },
  { id: "detail", label: "Detail" },
  { id: "other", label: "Other" },
];

interface ProductData {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  brandId: string;
}

interface ImageData {
  name: string;
  url: string;
  size: number;
  updatedAt: string;
  category: string;
}

interface GeneratedImage {
  imageId: string;
  status: string;
  filePath: string;
}

interface GeneratedJob {
  jobId: string;
  workflowType: string;
  status: string;
  createdAt: string;
  images: GeneratedImage[];
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedJobs, setGeneratedJobs] = useState<GeneratedJob[]>([]);
  const [uploadCategory, setUploadCategory] = useState("primary");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProduct = useCallback(async () => {
    const res = await fetch(`/api/products`);
    if (!res.ok) return;
    const data = await res.json();
    const found = data.products?.find(
      (p: ProductData) => p.id === productId,
    );
    if (found) setProduct(found);
  }, [productId]);

  const loadImages = useCallback(async () => {
    const res = await fetch(`/api/products/${productId}/images`);
    if (!res.ok) return;
    const data = await res.json();
    setImages(data.images ?? []);
  }, [productId]);

  const loadGeneratedImages = useCallback(async () => {
    const res = await fetch(`/api/jobs?productId=${encodeURIComponent(productId)}`);
    if (!res.ok) return;
    const data = await res.json();
    setGeneratedJobs(data.jobs ?? []);
  }, [productId]);

  useEffect(() => {
    loadProduct();
    loadImages();
    loadGeneratedImages();
  }, [loadProduct, loadImages, loadGeneratedImages]);

  async function handleUpload(files: FileList | File[]) {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      formData.append("category", uploadCategory);

      const res = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(fileName: string) {
    setConfirmAction({
      title: "Delete image",
      message: `Are you sure you want to delete "${fileName}"? This cannot be undone.`,
      action: async () => {
        setDeleting(fileName);
        setError(null);
        try {
          const res = await fetch(
            `/api/products/${productId}/images?name=${encodeURIComponent(fileName)}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Delete failed");
          }
          toast("Image deleted", "success");
          await loadImages();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Delete failed");
        } finally {
          setDeleting(null);
        }
      },
    });
  }

  async function handleCategoryChange(fileName: string, newCategory: string) {
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fileName, category: newCategory }),
      });
      if (res.ok) {
        setImages((prev) =>
          prev.map((img) =>
            img.name === fileName ? { ...img, category: newCategory } : img,
          ),
        );
        toast("Category updated", "success");
      }
    } catch {
      toast("Failed to update category", "error");
    }
  }

  function startEditing() {
    if (!product) return;
    setEditForm({
      name: product.name,
      category: product.category,
      description: product.description,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Update failed");
      }
      setEditing(false);
      await loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteProduct() {
    setConfirmAction({
      title: "Delete product",
      message: `Are you sure you want to delete "${product?.name}"? All data including reference images will be lost. This cannot be undone.`,
      action: async () => {
        try {
          const res = await fetch(`/api/products/${productId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Delete failed");
          }
          router.push("/dashboard/products");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Delete failed");
        }
      },
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center py-20">
        <p
          className="text-sm animate-pulse"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Loading product…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 gs-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard/products"
          className="transition-colors"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Products
        </Link>
        <span style={{ color: "var(--gs-text-faint)" }}>/</span>
        <span style={{ color: "var(--gs-text-secondary)" }}>
          {product.name}
        </span>
      </div>

      {/* Product info */}
      <section className="gs-card-static p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                className="gs-input block w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Category
              </label>
              <input
                type="text"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
                className="gs-input block w-full px-3 py-2 text-sm"
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
                rows={3}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                className="gs-input block w-full px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="gs-btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name.trim()}
                className="gs-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1
                  className="text-2xl font-bold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {product.name}
                </h1>
                {product.category && (
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--gs-text-faint)" }}
                  >
                    {product.category}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={
                    product.status === "active"
                      ? {
                          background: "var(--gs-success-bg)",
                          color: "var(--gs-success-text)",
                        }
                      : {
                          background: "var(--gs-surface-inset)",
                          color: "var(--gs-text-muted)",
                        }
                  }
                >
                  {product.status}
                </span>
                <button
                  onClick={startEditing}
                  className="gs-btn-secondary px-3 py-1.5 text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteProduct}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                  style={{
                    background: "var(--gs-error-bg)",
                    color: "var(--gs-error-text)",
                    border:
                      "1px solid color-mix(in srgb, var(--gs-error-text) 25%, transparent)",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {product.description && (
              <p
                className="mt-3 text-sm"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {product.description}
              </p>
            )}
          </>
        )}
      </section>

      {/* Reference Images */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            Reference Images
          </h2>
          <span className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
            {images.length} image{images.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Upload category + drop zone */}
        <div className="flex items-center gap-3 mb-2">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Upload as:
          </label>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="gs-input px-2 py-1 text-sm"
          >
            {IMAGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-xl p-8 text-center transition-all"
          style={{
            border: `2px dashed ${dragOver ? "var(--gs-accent)" : "var(--gs-border)"}`,
            background: dragOver
              ? "var(--gs-accent-subtle)"
              : "var(--gs-surface)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <UploadIcon />
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {uploading
              ? "Uploading…"
              : "Drop images here or click to browse"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--gs-text-faint)" }}>
            JPEG, PNG, or WebP — max 10 MB each
          </p>
        </div>

        {error && (
          <p
            className="rounded-lg p-3 text-sm"
            style={{
              background: "var(--gs-error-bg)",
              color: "var(--gs-error-text)",
            }}
          >
            {error}
          </p>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.name}
                className="gs-card group relative overflow-hidden"
              >
                <ZoomableImage
                  src={img.url}
                  alt={img.name}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-white">{img.name}</p>
                      <p className="text-xs text-white/70">
                        {formatSize(img.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.name);
                      }}
                      disabled={deleting === img.name}
                      className="shrink-0 rounded p-1 text-white/80 hover:text-red-400 hover:bg-black/30 transition disabled:opacity-50"
                      title="Delete image"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Category badge */}
                <div className="absolute top-2 left-2">
                  <select
                    value={img.category}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleCategoryChange(img.name, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer border-0"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(4px)",
                      color: "white",
                    }}
                  >
                    {IMAGE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && !uploading && (
          <p
            className="text-center text-sm py-4"
            style={{ color: "var(--gs-text-faint)" }}
          >
            No reference images yet. Upload some to use in image generation.
          </p>
        )}
      </section>

      {/* Generated Images */}
      <GeneratedImagesSection
        jobs={generatedJobs}
        productId={productId}
        productName={product.name}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function generatedImageUrl(filePath: string): string {
  const idx = filePath.indexOf("/generated/");
  if (idx === -1) return filePath;
  const relative = filePath.substring(idx + "/generated/".length);
  return `/api/images/${relative}`;
}

function workflowLabel(wt: string) {
  return wt === "AMAZON_LIFESTYLE_SHOT" ? "Lifestyle" : "Product shot";
}

function GeneratedImagesSection({
  jobs,
  productId,
  productName,
}: {
  jobs: GeneratedJob[];
  productId: string;
  productName: string;
}) {
  const totalImages = jobs.reduce((sum, j) => sum + j.images.length, 0);
  const sortedJobs = [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          Generated Images
        </h2>
        <div className="flex items-center gap-3">
          <span
            className="text-sm"
            style={{ color: "var(--gs-text-faint)" }}
          >
            {totalImages} image{totalImages !== 1 ? "s" : ""} · {sortedJobs.length} job{sortedJobs.length !== 1 ? "s" : ""}
          </span>
          <Link
            href={`/dashboard/generate?productId=${encodeURIComponent(productId)}&tab=images`}
            className="gs-btn-primary px-3 py-1.5 text-xs"
          >
            Generate more
          </Link>
        </div>
      </div>

      {sortedJobs.length === 0 ? (
        <EmptyState
          icon="🖼️"
          title={`No images for ${productName}`}
          description="Generate your first product images to see them here."
          actionLabel="Generate images"
          actionHref={`/dashboard/generate?productId=${encodeURIComponent(productId)}&tab=images`}
        />
      ) : (
        <div className="space-y-6">
          {sortedJobs.map((job) => (
            <div key={job.jobId} className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--gs-text-secondary)" }}
                >
                  {workflowLabel(job.workflowType)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={
                    job.status === "completed"
                      ? {
                          background: "var(--gs-success-bg)",
                          color: "var(--gs-success-text)",
                        }
                      : job.status === "failed"
                        ? {
                            background: "var(--gs-error-bg)",
                            color: "var(--gs-error-text)",
                          }
                        : {
                            background: "var(--gs-surface-inset)",
                            color: "var(--gs-text-muted)",
                          }
                  }
                >
                  {job.status}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  {formatRelative(job.createdAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {job.images.map((img) => (
                  <div key={img.imageId} className="gs-card group overflow-hidden">
                    <ZoomableImage
                      src={generatedImageUrl(img.filePath)}
                      alt={`Generated ${img.imageId.slice(0, 6)}`}
                      className="aspect-[4/5] w-full object-cover"
                    />
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--gs-text-faint)" }}
                        >
                          {img.imageId.slice(0, 8)}
                        </span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={
                            img.status === "favorite"
                              ? {
                                  background: "var(--gs-success-bg)",
                                  color: "var(--gs-success-text)",
                                }
                              : img.status === "rejected"
                                ? {
                                    background: "var(--gs-error-bg)",
                                    color: "var(--gs-error-text)",
                                  }
                                : {
                                    background: "var(--gs-surface-inset)",
                                    color: "var(--gs-text-muted)",
                                  }
                          }
                        >
                          {img.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UploadIcon() {
  return (
    <svg
      className="mx-auto h-8 w-8"
      style={{ color: "var(--gs-text-faint)" }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}
