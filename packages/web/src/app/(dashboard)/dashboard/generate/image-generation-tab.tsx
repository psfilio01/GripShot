"use client";

import { useState, type FormEvent } from "react";

interface JobImage {
  imageId: string;
  status: string;
  filePath: string;
}

interface JobResult {
  jobId: string;
  status: string;
  images: JobImage[];
}

export function ImageGenerationTab() {
  const [productId, setProductId] = useState("pilates-mini-ball");
  const [workflowType, setWorkflowType] = useState<string>(
    "NEUTRAL_PRODUCT_SHOT",
  );
  const [useGoldenBg, setUseGoldenBg] = useState(false);
  const [creativeFreedom, setCreativeFreedom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setJob(null);
    setBusy(true);

    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          workflowType,
          useGoldenBackground: useGoldenBg,
          creativeFreedom,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            `Quota exceeded (${data.used}/${data.limit} credits used). Upgrade your plan for more credits.`,
          );
        }
        throw new Error(data.error ?? "Generation failed");
      }
      setJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function imageUrl(filePath: string): string {
    const dataRoot = filePath.indexOf("/generated/");
    if (dataRoot === -1) return filePath;
    const relative = filePath.substring(dataRoot + "/generated/".length);
    return `/api/images/${encodeURIComponent(relative)}`;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="gs-card-static p-6 space-y-4">
        <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
          Uses the workflow-core engine with local product data from the{" "}
          <code
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              background: "var(--gs-surface-inset)",
              color: "var(--gs-text-muted)",
            }}
          >
            data/products/
          </code>{" "}
          folder.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Product ID
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
              placeholder="e.g. pilates-mini-ball"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Workflow type
            </label>
            <select
              value={workflowType}
              onChange={(e) => setWorkflowType(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
            >
              <option value="NEUTRAL_PRODUCT_SHOT">
                Neutral product shot
              </option>
              <option value="AMAZON_LIFESTYLE_SHOT">
                Amazon lifestyle shot
              </option>
            </select>
          </div>
        </div>

        {workflowType === "AMAZON_LIFESTYLE_SHOT" && (
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useGoldenBg}
                onChange={(e) => setUseGoldenBg(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--gs-accent)" }}
              />
              <span
                className="text-sm"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Golden background
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={creativeFreedom}
                onChange={(e) => setCreativeFreedom(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--gs-accent)" }}
              />
              <span
                className="text-sm"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Creative freedom
              </span>
            </label>
          </div>
        )}

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

        <button
          type="submit"
          disabled={busy || !productId.trim()}
          className="gs-btn-primary px-5 py-2.5 text-sm"
        >
          {busy ? "Generating…" : "Generate image"}
        </button>
      </form>

      {job && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--gs-text)" }}
            >
              Job {job.jobId.slice(0, 8)}…
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {job.images.map((img) => (
              <div key={img.imageId} className="gs-card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(img.filePath)}
                  alt={`Generated ${img.imageId.slice(0, 6)}`}
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="p-3 flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: "var(--gs-text-faint)" }}
                  >
                    {img.imageId.slice(0, 8)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: "var(--gs-surface-inset)",
                      color: "var(--gs-text-muted)",
                    }}
                  >
                    {img.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
