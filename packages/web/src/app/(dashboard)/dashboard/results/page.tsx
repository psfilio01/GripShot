"use client";

import { useEffect, useState } from "react";
import { ZoomableImage } from "@/components/zoomable-image";

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

type Filter = "all" | "neutral" | "favorite" | "rejected";

export default function ResultsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

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
      if (res.ok) loadJobs();
    } catch {
      // silently fail
    }
  }

  const allImages = jobs.flatMap((j) =>
    j.images.map((img) => ({
      ...img,
      productId: j.productId,
      workflowType: j.workflowType,
      jobId: j.jobId,
      createdAt: j.createdAt,
    })),
  );

  const filteredImages =
    filter === "all"
      ? allImages
      : allImages.filter((img) => img.status === filter);

  function imageUrl(filePath: string): string {
    const idx = filePath.indexOf("/generated/");
    if (idx === -1) return filePath;
    const relative = filePath.substring(idx + "/generated/".length);
    return `/api/images/${relative}`;
  }

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "neutral", label: "Neutral" },
    { value: "favorite", label: "Favorites" },
    { value: "rejected", label: "Rejected" },
  ];

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
        <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
          {filteredImages.length} image
          {filteredImages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all"
            style={
              filter === f.value
                ? {
                    background: "var(--gs-surface)",
                    color: "var(--gs-text)",
                    boxShadow: "var(--gs-shadow-sm)",
                  }
                : {
                    color: "var(--gs-text-muted)",
                  }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

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
            {filter === "all"
              ? "No images generated yet. Go to Generate to create your first."
              : `No ${filter} images found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((img) => (
            <div key={img.imageId} className="gs-card group overflow-hidden">
              <ZoomableImage
                src={imageUrl(img.filePath)}
                alt={`${img.productId} — ${img.imageId.slice(0, 6)}`}
                className="aspect-[4/5] w-full object-cover"
              />
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
                <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
                  {img.workflowType === "AMAZON_LIFESTYLE_SHOT"
                    ? "Lifestyle"
                    : "Product shot"}
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
