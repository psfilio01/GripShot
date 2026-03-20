"use client";

import { useEffect, useState } from "react";

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

  async function handleFeedback(imageId: string, action: "favorite" | "reject") {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
            Results
          </h1>
          <p className="mt-1 text-sm text-sand-500">
            Browse, filter, and manage your generated images.
          </p>
        </div>
        <p className="text-xs text-sand-400">
          {filteredImages.length} image{filteredImages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-sand-100 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === f.value
                ? "bg-white text-sand-800 shadow-sm"
                : "text-sand-500 hover:text-sand-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <p className="text-sm text-sand-400 animate-pulse">
            Loading results…
          </p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-sand-300 bg-white p-12 text-center">
          <p className="text-sm text-sand-500">
            {filter === "all"
              ? "No images generated yet. Go to Generate to create your first."
              : `No ${filter} images found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((img) => (
            <div
              key={img.imageId}
              className="group overflow-hidden rounded-xl border border-sand-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(img.filePath)}
                alt={`${img.productId} — ${img.imageId.slice(0, 6)}`}
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-sand-600">
                    {img.productId}
                  </span>
                  <StatusBadge status={img.status} />
                </div>
                <p className="text-xs text-sand-400">
                  {img.workflowType === "AMAZON_LIFESTYLE_SHOT"
                    ? "Lifestyle"
                    : "Product shot"}
                </p>
                {img.status === "neutral" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleFeedback(img.imageId, "favorite")}
                      className="flex-1 rounded-lg border border-olive-200 bg-olive-50 py-1.5 text-xs font-medium text-olive-600 hover:bg-olive-100 transition"
                    >
                      ♥ Favorite
                    </button>
                    <button
                      onClick={() => handleFeedback(img.imageId, "reject")}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 transition"
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    neutral: "bg-sand-100 text-sand-600",
    favorite: "bg-olive-100 text-olive-600",
    rejected: "bg-red-100 text-red-500",
    variant: "bg-peach-100 text-peach-600",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? styles.neutral
      }`}
    >
      {status}
    </span>
  );
}
