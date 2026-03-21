"use client";

import { useEffect, useMemo, useState } from "react";
import { ZoomableImage } from "@/components/zoomable-image";
import { useToast } from "@/components/toast";

interface JobImage {
  imageId: string;
  status: string;
  filePath: string;
}

interface Job {
  jobId: string;
  productId: string;
  workflowType: string;
  status: string;
  createdAt: string;
  images: JobImage[];
}

type StatusFilter = "all" | "neutral" | "favorite" | "rejected";

export default function ResultsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  function loadJobs() {
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.jobs) setJobs(d.jobs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleFeedback(
    imageId: string,
    action: "favorite" | "reject",
  ) {
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, action }),
      });
      if (res.ok) {
        loadJobs();
        toast(
          action === "favorite" ? "Added to favorites" : "Image rejected",
          action === "favorite" ? "success" : "info",
        );
      }
    } catch {
      toast("Action failed", "error");
    }
  }

  const allImages = useMemo(
    () =>
      jobs.flatMap((j) =>
        j.images.map((img) => ({
          ...img,
          productId: j.productId,
          workflowType: j.workflowType,
          jobId: j.jobId,
          createdAt: j.createdAt,
        })),
      ),
    [jobs],
  );

  const uniqueProducts = useMemo(
    () => [...new Set(allImages.map((i) => i.productId))].sort(),
    [allImages],
  );

  const uniqueTypes = useMemo(
    () => [...new Set(allImages.map((i) => i.workflowType))].sort(),
    [allImages],
  );

  const filteredImages = useMemo(() => {
    let result = allImages;
    if (statusFilter !== "all")
      result = result.filter((img) => img.status === statusFilter);
    if (productFilter !== "all")
      result = result.filter((img) => img.productId === productFilter);
    if (typeFilter !== "all")
      result = result.filter((img) => img.workflowType === typeFilter);
    return result;
  }, [allImages, statusFilter, productFilter, typeFilter]);

  function imageUrl(filePath: string): string {
    const idx = filePath.indexOf("/generated/");
    if (idx === -1) return filePath;
    const relative = filePath.substring(idx + "/generated/".length);
    return `/api/images/${relative}`;
  }

  async function handleDownload(filePath: string, imageId: string) {
    const url = imageUrl(filePath);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = filePath.split(".").pop() ?? "png";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `grip-shot-${imageId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast("Image downloaded", "success");
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleBulkDownload() {
    setDownloading(true);
    try {
      const body: Record<string, string> = {};
      if (statusFilter !== "all") body.status = statusFilter;
      if (productFilter !== "all") body.productId = productFilter;

      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? "grip-shot-images.zip";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast("ZIP downloaded", "success");
    } catch {
      toast("Download failed", "error");
    } finally {
      setDownloading(false);
    }
  }

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "neutral", label: "Neutral" },
    { value: "favorite", label: "Favorites" },
    { value: "rejected", label: "Rejected" },
  ];

  const workflowLabel = (wt: string) =>
    wt === "AMAZON_LIFESTYLE_SHOT" ? "Lifestyle" : "Product shot";

  const hasFilters =
    productFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6 gs-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--gs-text)" }}
          >
            Results
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
            Browse, filter, and manage your generated images.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            {filteredImages.length} image
            {filteredImages.length !== 1 ? "s" : ""}
            {hasFilters && ` of ${allImages.length}`}
          </p>
          {filteredImages.length > 0 && (
            <button
              onClick={handleBulkDownload}
              disabled={downloading}
              className="gs-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {downloading ? "Zipping…" : "Download ZIP"}
            </button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all"
            style={
              statusFilter === f.value
                ? {
                    background: "var(--gs-surface)",
                    color: "var(--gs-text)",
                    boxShadow: "var(--gs-shadow-sm)",
                  }
                : { color: "var(--gs-text-muted)" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Product + type filters */}
      {(uniqueProducts.length > 1 || uniqueTypes.length > 1) && (
        <div className="flex flex-wrap gap-3">
          {uniqueProducts.length > 1 && (
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="gs-input px-3 py-1.5 text-sm"
            >
              <option value="all">All products</option>
              {uniqueProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {uniqueTypes.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="gs-input px-3 py-1.5 text-sm"
            >
              <option value="all">All types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {workflowLabel(t)}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setProductFilter("all");
                setTypeFilter("all");
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition"
              style={{ color: "var(--gs-accent-text)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <p
            className="text-sm animate-pulse"
            style={{ color: "var(--gs-text-faint)" }}
          >
            Loading results…
          </p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{
            border: "2px dashed var(--gs-border)",
            background: "var(--gs-surface-inset)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
            {!hasFilters
              ? "No images generated yet. Go to Generate to create your first."
              : "No images match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((img) => (
            <div key={img.imageId} className="gs-card group overflow-hidden">
              <div className="relative">
                <ZoomableImage
                  src={imageUrl(img.filePath)}
                  alt={`${img.productId} — ${img.imageId.slice(0, 6)}`}
                  className="aspect-[4/5] w-full object-cover"
                />
                {/* Download button overlay */}
                <button
                  onClick={() => handleDownload(img.filePath, img.imageId)}
                  title="Download image"
                  className="absolute top-2 right-2 rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    color: "white",
                  }}
                >
                  <DownloadIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--gs-text-secondary)" }}
                  >
                    {img.productId}
                  </span>
                  <ImageStatusBadge status={img.status} />
                </div>
                <p
                  className="text-xs"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  {workflowLabel(img.workflowType)}
                </p>
                {img.status === "neutral" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleFeedback(img.imageId, "favorite")}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium transition"
                      style={{
                        background: "var(--gs-success-bg)",
                        color: "var(--gs-success-text)",
                        border:
                          "1px solid color-mix(in srgb, var(--gs-success-text) 25%, transparent)",
                      }}
                    >
                      ♥ Favorite
                    </button>
                    <button
                      onClick={() => handleFeedback(img.imageId, "reject")}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium transition"
                      style={{
                        background: "var(--gs-error-bg)",
                        color: "var(--gs-error-text)",
                        border:
                          "1px solid color-mix(in srgb, var(--gs-error-text) 25%, transparent)",
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function ImageStatusBadge({ status }: { status: string }) {
  const getStyle = (s: string) => {
    switch (s) {
      case "favorite":
        return {
          background: "var(--gs-success-bg)",
          color: "var(--gs-success-text)",
        };
      case "rejected":
        return {
          background: "var(--gs-error-bg)",
          color: "var(--gs-error-text)",
        };
      default:
        return {
          background: "var(--gs-surface-inset)",
          color: "var(--gs-text-muted)",
        };
    }
  };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={getStyle(status)}
    >
      {status}
    </span>
  );
}
