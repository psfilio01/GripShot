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
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
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
      <form
        onSubmit={handleGenerate}
        className="rounded-xl border border-sand-200 bg-white p-6 space-y-4"
      >
        <p className="text-xs text-sand-400">
          Uses the workflow-core engine with local product data from the{" "}
          <code className="bg-sand-100 px-1 rounded">data/products/</code>{" "}
          folder.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-sand-700">
              Product ID
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
              placeholder="e.g. pilates-mini-ball"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sand-700">
              Workflow type
            </label>
            <select
              value={workflowType}
              onChange={(e) => setWorkflowType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useGoldenBg}
                onChange={(e) => setUseGoldenBg(e.target.checked)}
                className="h-4 w-4 rounded border-sand-300 text-peach-500 focus:ring-peach-300"
              />
              <span className="text-sm text-sand-700">
                Golden background
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={creativeFreedom}
                onChange={(e) => setCreativeFreedom(e.target.checked)}
                className="h-4 w-4 rounded border-sand-300 text-peach-500 focus:ring-peach-300"
              />
              <span className="text-sm text-sand-700">
                Creative freedom
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !productId.trim()}
          className="rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-peach-400 disabled:opacity-50 transition"
        >
          {busy ? "Generating…" : "Generate image"}
        </button>
      </form>

      {job && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-sand-700">
              Job {job.jobId.slice(0, 8)}…
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                job.status === "completed"
                  ? "bg-olive-100 text-olive-600"
                  : job.status === "failed"
                    ? "bg-red-100 text-red-600"
                    : "bg-sand-100 text-sand-600"
              }`}
            >
              {job.status}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {job.images.map((img) => (
              <div
                key={img.imageId}
                className="overflow-hidden rounded-xl border border-sand-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(img.filePath)}
                  alt={`Generated ${img.imageId.slice(0, 6)}`}
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-sand-400">
                    {img.imageId.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600">
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
