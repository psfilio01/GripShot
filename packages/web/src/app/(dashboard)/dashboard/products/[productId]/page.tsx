"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  const [product, setProduct] = useState<ProductData | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-sand-800">
              {product.name}
            </h1>
            {product.category && (
              <p className="mt-1 text-sm text-sand-400">{product.category}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              product.status === "active"
                ? "bg-olive-100 text-olive-600"
                : "bg-sand-100 text-sand-600"
            }`}
          >
            {product.status}
          </span>
        </div>
        {product.description && (
          <p className="mt-3 text-sm text-sand-500">{product.description}</p>
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
                <img
                  src={img.url}
                  alt={img.name}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                  <p className="truncate text-xs text-white">{img.name}</p>
                  <p className="text-xs text-white/70">
                    {formatSize(img.size)}
                  </p>
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
