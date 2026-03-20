"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ZoomableImage } from "@/components/zoomable-image";

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
  const [editForm, setEditForm] = useState({ name: "", category: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    loadProduct();
    loadImages();
  }, [loadProduct, loadImages]);

  async function handleUpload(files: FileList | File[]) {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

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

  async function handleDelete(fileName: string) {
    if (!confirm(`Delete ${fileName}?`)) return;
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
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
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

  async function handleDeleteProduct() {
    if (!confirm(`Delete "${product?.name}"? This cannot be undone.`)) return;
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
        <p className="text-sm text-sand-400">Loading product…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-sand-400">
        <Link
          href="/dashboard/products"
          className="hover:text-sand-600 transition"
        >
          Products
        </Link>
        <span>/</span>
        <span className="text-sand-700">{product.name}</span>
      </div>

      {/* Product info */}
      <section className="rounded-xl border border-sand-200 bg-white p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-sand-700">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-700">Category</label>
              <input
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-700">Description</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-sand-200 px-4 py-2 text-sm font-medium text-sand-600 hover:bg-sand-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name.trim()}
                className="rounded-lg bg-peach-500 px-4 py-2 text-sm font-medium text-white hover:bg-peach-400 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-sand-800">
                  {product.name}
                </h1>
                {product.category && (
                  <p className="mt-1 text-sm text-sand-400">{product.category}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    product.status === "active"
                      ? "bg-olive-100 text-olive-600"
                      : "bg-sand-100 text-sand-600"
                  }`}
                >
                  {product.status}
                </span>
                <button
                  onClick={startEditing}
                  className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-medium text-sand-600 hover:bg-sand-50 transition"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteProduct}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
            {product.description && (
              <p className="mt-3 text-sm text-sand-500">{product.description}</p>
            )}
          </>
        )}
      </section>

      {/* Reference Images */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-sand-800">
            Reference Images
          </h2>
          <span className="text-sm text-sand-400">
            {images.length} image{images.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-peach-400 bg-peach-50"
              : "border-sand-300 bg-white hover:border-sand-400 hover:bg-sand-50"
          }`}
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
          <UploadIcon className="mx-auto h-8 w-8 text-sand-300" />
          <p className="mt-2 text-sm font-medium text-sand-600">
            {uploading
              ? "Uploading…"
              : "Drop images here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-sand-400">
            JPEG, PNG, or WebP — max 10 MB each
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.name}
                className="group relative overflow-hidden rounded-lg border border-sand-200 bg-white"
              >
                <ZoomableImage
                  src={img.url}
                  alt={img.name}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                  <div className="flex items-end justify-between">
                    <div>
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
                      className="rounded p-1 text-white/80 hover:text-red-400 hover:bg-black/30 transition disabled:opacity-50"
                      title="Delete image"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && !uploading && (
          <p className="text-center text-sm text-sand-400 py-4">
            No reference images yet. Upload some to use in image generation.
          </p>
        )}
      </section>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
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
