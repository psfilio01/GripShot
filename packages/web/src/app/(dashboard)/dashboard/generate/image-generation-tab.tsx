"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";

interface ProductOption {
  id: string;
  name: string;
}

interface HumanModelOption {
  id: string;
  displayName: string;
}

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

export function ImageGenerationTab({
  prefillProductId,
}: {
  prefillProductId?: string;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState(prefillProductId ?? "");
  const [workflowType, setWorkflowType] = useState<string>(
    "NEUTRAL_PRODUCT_SHOT",
  );
  const [useGoldenBg, setUseGoldenBg] = useState(false);
  const [creativeFreedom, setCreativeFreedom] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [resolution, setResolution] = useState("2K");
  const [humanModels, setHumanModels] = useState<HumanModelOption[]>([]);
  /** Empty string = random among workspace models */
  const [humanModelId, setHumanModelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.products) {
          setProducts(d.products);
          const match = prefillProductId
            ? d.products.find((p: ProductOption) => p.id === prefillProductId)
            : null;
          if (!productId) {
            setProductId(match?.id ?? d.products[0]?.id ?? "");
          }
        }
      })
      .catch(() => {});

    fetch("/api/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return;
        if (prefs.defaultAspectRatio) setAspectRatio(prefs.defaultAspectRatio);
        if (prefs.defaultResolution) setResolution(prefs.defaultResolution);
        if (prefs.defaultWorkflowType) setWorkflowType(prefs.defaultWorkflowType);
        if (prefs.defaultHumanModelId !== undefined && prefs.defaultHumanModelId !== null) {
          setHumanModelId(prefs.defaultHumanModelId);
        }
      })
      .catch(() => {});

    fetch("/api/human-models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.models) setHumanModels(d.models);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!humanModelId || humanModels.length === 0) return;
    if (!humanModels.some((m) => m.id === humanModelId)) {
      setHumanModelId("");
    }
  }, [humanModels, humanModelId]);

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
          aspectRatio,
          resolution,
          ...(workflowType === "AMAZON_LIFESTYLE_SHOT" && humanModelId.trim()
            ? { modelId: humanModelId.trim() }
            : {}),
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
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
            >
              {products.length === 0 && (
                <option value="">Loading products…</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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

        {/* Generation settings */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Aspect ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
            >
              <option value="4:5">4:5 (Amazon main)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="3:4">3:4</option>
              <option value="16:9">16:9 (Wide)</option>
              <option value="9:16">9:16 (Tall)</option>
              <option value="2:3">2:3</option>
              <option value="3:2">3:2</option>
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
            >
              <option value="2K">2K (default)</option>
              <option value="4K">4K (high quality)</option>
              <option value="1K">1K (fast preview)</option>
              <option value="512">512px (fastest)</option>
            </select>
          </div>
        </div>

        {workflowType === "AMAZON_LIFESTYLE_SHOT" && (
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Human model
              </label>
              <select
                value={humanModelId}
                onChange={(e) => setHumanModelId(e.target.value)}
                className="gs-input block w-full max-w-md px-3 py-2 text-sm"
              >
                <option value="">
                  Random (from your workspace models)
                </option>
                {humanModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs" style={{ color: "var(--gs-text-faint)" }}>
                {humanModels.length === 0 ? (
                  <>
                    No models yet —{" "}
                    <Link
                      href="/dashboard/human-models"
                      className="font-medium underline"
                      style={{ color: "var(--gs-accent-text)" }}
                    >
                      add reference photos
                    </Link>{" "}
                    for lifestyle shots with a consistent face/body.
                  </>
                ) : (
                  <>
                    Manage models in{" "}
                    <Link
                      href="/dashboard/human-models"
                      className="font-medium underline"
                      style={{ color: "var(--gs-accent-text)" }}
                    >
                      Models
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !productId.trim()}
            className="gs-btn-primary px-5 py-2.5 text-sm"
          >
            {busy ? "Generating…" : "Generate image"}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/preferences", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    defaultAspectRatio: aspectRatio,
                    defaultResolution: resolution,
                    defaultWorkflowType: workflowType,
                    defaultHumanModelId: humanModelId,
                  }),
                });
                toast("Defaults saved", "success");
              } catch {
                toast("Failed to save defaults", "error");
              }
            }}
            className="gs-btn-secondary px-4 py-2.5 text-sm"
          >
            Save as defaults
          </button>
        </div>
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
