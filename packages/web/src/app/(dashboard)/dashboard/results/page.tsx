"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ZoomableImage } from "@/components/zoomable-image";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { ResultsSkeleton } from "@/components/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface JobImage {
  imageId: string;
  status: string;
  filePath: string;
  heroLockId?: string;
  colorLineage?: {
    parentVariantId: string;
    targetColorName: string;
    targetColorHex: string;
    generationMethod: string;
  };
}

interface Job {
  jobId: string;
  productId: string;
  workflowType: string;
  status: string;
  createdAt: string;
  images: JobImage[];
}

interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

type StatusFilter = "all" | "neutral" | "favorite" | "rejected" | "hero_lock";

export default function ResultsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [heroLockTarget, setHeroLockTarget] = useState<{
    imageId: string;
    productId: string;
  } | null>(null);
  const [heroLockColors, setHeroLockColors] = useState<ProductColor[]>([]);
  const [heroLocking, setHeroLocking] = useState(false);
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const { toast } = useToast();

  const loadJobs = useCallback(() => {
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.jobs) setJobs(d.jobs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadJobs();
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.products) {
          const map: Record<string, string> = {};
          for (const p of d.products) {
            map[p.id] = p.name;
          }
          setProductNames(map);
        }
      })
      .catch(() => {});
  }, [loadJobs]);

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

  async function openHeroLockDialog(imageId: string, productId: string) {
    setHeroLockTarget({ imageId, productId });
    try {
      const res = await fetch(`/api/products/${productId}/colors`);
      if (res.ok) {
        const data = await res.json();
        setHeroLockColors(data.colors ?? []);
      } else {
        setHeroLockColors([]);
      }
    } catch {
      setHeroLockColors([]);
    }
  }

  async function executeHeroLock() {
    if (!heroLockTarget || heroLockColors.length === 0) return;
    setHeroLocking(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: heroLockTarget.imageId,
          action: "hero_lock",
          targetColors: heroLockColors.map((c) => ({
            id: c.id,
            name: c.name,
            hex: c.hex,
          })),
        }),
      });
      if (res.ok) {
        toast(
          `Hero Lock activated — generating ${heroLockColors.length} color variant(s)`,
          "success",
        );
        loadJobs();
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? "Hero Lock failed", "error");
      }
    } catch {
      toast("Hero Lock failed", "error");
    } finally {
      setHeroLocking(false);
      setHeroLockTarget(null);
      setHeroLockColors([]);
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

  const heroLockedIds = useMemo(
    () => new Set(allImages.filter((i) => i.status === "hero_lock").map((i) => i.imageId)),
    [allImages],
  );

  const variantsByParent = useMemo(() => {
    const map = new Map<string, typeof allImages>();
    for (const img of allImages) {
      if (img.colorLineage?.parentVariantId) {
        const pid = img.colorLineage.parentVariantId;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(img);
      }
    }
    return map;
  }, [allImages]);

  const selectedDetail = detailImage
    ? allImages.find((i) => i.imageId === detailImage) ?? null
    : null;

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
    { value: "hero_lock", label: "Hero Locked" },
    { value: "rejected", label: "Rejected" },
  ];

  const workflowLabel = (wt: string) =>
    wt === "AMAZON_LIFESTYLE_SHOT"
      ? "Lifestyle"
      : wt === "HERO_LOCK_RECOLOR"
        ? "Color variant"
        : "Product shot";

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
                  {productNames[p] ?? p}
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
        <ResultsSkeleton />
      ) : filteredImages.length === 0 ? (
        !hasFilters ? (
          <EmptyState
            icon="🎨"
            title="No images generated yet"
            description="Head to the Generate page to create your first AI-powered product images. They'll appear here once ready."
            actionLabel="Generate images"
            actionHref="/dashboard/generate?tab=images"
          />
        ) : (
          <EmptyState
            icon="🔍"
            title="No images match your filters"
            description="Try adjusting your filter criteria to see more results."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((img) => {
            const derivedCount = variantsByParent.get(img.imageId)?.length ?? 0;
            const isHeroLocked = img.status === "hero_lock";
            const isColorVariant = !!img.colorLineage;

            return (
              <div
                key={img.imageId}
                className="gs-card group overflow-hidden"
                style={
                  isHeroLocked
                    ? {
                        borderColor: "var(--gs-accent)",
                        boxShadow:
                          "0 0 0 1px var(--gs-accent), var(--gs-shadow-sm)",
                      }
                    : undefined
                }
              >
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
                  {/* Hero Lock badge */}
                  {isHeroLocked && (
                    <div
                      className="absolute top-2 left-2 rounded-lg px-2 py-1 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--gs-accent), var(--gs-accent-hover))",
                        color: "white",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      <HeroLockIcon className="h-3 w-3" />
                      Hero Lock
                    </div>
                  )}
                  {/* Color variant swatch */}
                  {isColorVariant && img.colorLineage && (
                    <div
                      className="absolute top-2 left-2 rounded-lg px-2 py-1 text-[10px] font-medium flex items-center gap-1.5"
                      style={{
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        color: "white",
                      }}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border border-white/50"
                        style={{
                          backgroundColor: img.colorLineage.targetColorHex,
                        }}
                      />
                      {img.colorLineage.targetColorName}
                    </div>
                  )}
                  {/* Derived variants badge */}
                  {derivedCount > 0 && (
                    <div
                      className="absolute bottom-2 left-2 rounded-lg px-2 py-1 text-[10px] font-medium"
                      style={{
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        color: "white",
                      }}
                    >
                      {derivedCount} color variant{derivedCount > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/products/${encodeURIComponent(img.productId)}`}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "var(--gs-text-secondary)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {productNames[img.productId] ?? img.productId}
                    </Link>
                    <ImageStatusBadge status={img.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      {workflowLabel(img.workflowType)}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      {formatRelativeTime(img.createdAt)}
                    </span>
                  </div>
                  {/* Details link for hero locked or color variant images */}
                  {(isHeroLocked || isColorVariant) && (
                    <button
                      onClick={() => setDetailImage(img.imageId)}
                      className="w-full text-xs py-1 rounded-lg transition"
                      style={{
                        color: "var(--gs-accent-text)",
                        background: "var(--gs-surface-inset)",
                      }}
                    >
                      View details
                    </button>
                  )}
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
                        onClick={() =>
                          openHeroLockDialog(img.imageId, img.productId)
                        }
                        className="flex-1 rounded-lg py-1.5 text-xs font-bold transition"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--gs-accent), var(--gs-accent-hover))",
                          color: "white",
                          border: "none",
                        }}
                        title="Lock this image as the master asset and generate color variants for all configured product colors"
                      >
                        <span className="flex items-center justify-center gap-1">
                          <HeroLockIcon className="h-3 w-3" />
                          Hero Lock
                        </span>
                      </button>
                      <button
                        onClick={() => handleFeedback(img.imageId, "reject")}
                        className="rounded-lg py-1.5 px-2.5 text-xs font-medium transition"
                        style={{
                          background: "var(--gs-error-bg)",
                          color: "var(--gs-error-text)",
                          border:
                            "1px solid color-mix(in srgb, var(--gs-error-text) 25%, transparent)",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hero Lock confirmation dialog */}
      {heroLockTarget && (
        <HeroLockDialog
          colors={heroLockColors}
          loading={heroLocking}
          productId={heroLockTarget.productId}
          productName={productNames[heroLockTarget.productId] ?? heroLockTarget.productId}
          onConfirm={executeHeroLock}
          onCancel={() => {
            setHeroLockTarget(null);
            setHeroLockColors([]);
          }}
        />
      )}

      {/* Image detail panel */}
      {selectedDetail && (
        <ImageDetailPanel
          image={selectedDetail}
          variants={variantsByParent.get(selectedDetail.imageId) ?? []}
          allImages={allImages}
          heroLockedIds={heroLockedIds}
          productName={productNames[selectedDetail.productId] ?? selectedDetail.productId}
          imageUrl={imageUrl}
          onClose={() => setDetailImage(null)}
        />
      )}
    </div>
  );
}

/* ---------- Hero Lock Dialog ---------- */

function HeroLockDialog({
  colors,
  loading,
  productId,
  productName,
  onConfirm,
  onCancel,
}: {
  colors: ProductColor[];
  loading: boolean;
  productId: string;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (colors.length === 0) {
    return (
      <ConfirmDialog
        open
        title="No colors configured"
        message={`Add product colors to "${productName}" first. Hero Lock generates same-scene variants for each configured color.`}
        confirmLabel="Add colors"
        variant="default"
        onConfirm={() => {
          onCancel();
          window.location.href = `/dashboard/products/${productId}#colors`;
        }}
        onCancel={onCancel}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      title="Activate Hero Lock"
      message={`This will lock the selected image as the master asset and generate ${colors.length} color variant${colors.length > 1 ? "s" : ""} (${colors.map((c) => c.name).join(", ")}). Colors matching the original will be automatically skipped.`}
      confirmLabel={loading ? "Generating…" : `Generate ${colors.length} variant${colors.length > 1 ? "s" : ""}`}
      variant="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/* ---------- Image Detail Panel ---------- */

function ImageDetailPanel({
  image,
  variants,
  allImages,
  heroLockedIds,
  productName,
  imageUrl,
  onClose,
}: {
  image: {
    imageId: string;
    status: string;
    filePath: string;
    productId: string;
    workflowType: string;
    heroLockId?: string;
    colorLineage?: {
      parentVariantId: string;
      targetColorName: string;
      targetColorHex: string;
      generationMethod: string;
    };
  };
  variants: typeof allImages;
  allImages: { imageId: string; status: string; filePath: string; colorLineage?: { parentVariantId: string; targetColorName: string; targetColorHex: string; generationMethod: string } }[];
  heroLockedIds: Set<string>;
  productName: string;
  imageUrl: (p: string) => string;
  onClose: () => void;
}) {
  const isHeroLocked = image.status === "hero_lock";
  const isColorVariant = !!image.colorLineage;
  const parentImage = isColorVariant
    ? allImages.find((i) => i.imageId === image.colorLineage!.parentVariantId)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--gs-surface-raised)",
          border: "1px solid var(--gs-border)",
          boxShadow: "var(--gs-shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg"
          style={{ color: "var(--gs-text-muted)" }}
        >
          ✕
        </button>

        <h3 className="text-lg font-bold" style={{ color: "var(--gs-text)" }}>
          Image Details
        </h3>

        <div className="space-y-3">
          <DetailRow label="Product" value={productName} />
          <DetailRow label="Status">
            <ImageStatusBadge status={image.status} />
          </DetailRow>
          <DetailRow label="Image ID" value={image.imageId.slice(0, 12)} />

          {isHeroLocked && (
            <>
              <DetailRow label="Role" value="Master asset (Hero Locked)" />
              <DetailRow
                label="Color variants"
                value={
                  variants.length > 0
                    ? `${variants.length} generated`
                    : "None yet"
                }
              />
              {variants.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {variants.map((v) => (
                    <span
                      key={v.imageId}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "var(--gs-surface-inset)",
                        color: "var(--gs-text-secondary)",
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            v.colorLineage?.targetColorHex ?? "#ccc",
                        }}
                      />
                      {v.colorLineage?.targetColorName ?? "Unknown"}
                      <span className="text-[9px] opacity-60">
                        ({v.status})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {isColorVariant && image.colorLineage && (
            <>
              <DetailRow label="Role" value="Color variant (derived)" />
              <DetailRow
                label="Target color"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full border"
                    style={{
                      backgroundColor: image.colorLineage.targetColorHex,
                      borderColor: "var(--gs-border)",
                    }}
                  />
                  {image.colorLineage.targetColorName} ({image.colorLineage.targetColorHex})
                </span>
              </DetailRow>
              <DetailRow
                label="Parent master"
                value={
                  parentImage
                    ? `${parentImage.imageId.slice(0, 12)} (${parentImage.status})`
                    : image.colorLineage.parentVariantId.slice(0, 12)
                }
              />
              <DetailRow
                label="Method"
                value={image.colorLineage.generationMethod}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="text-xs font-medium w-28 shrink-0"
        style={{ color: "var(--gs-text-muted)" }}
      >
        {label}
      </span>
      {children ?? (
        <span className="text-xs" style={{ color: "var(--gs-text)" }}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ---------- Shared components ---------- */

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

function HeroLockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
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
      case "hero_lock":
        return {
          background:
            "linear-gradient(135deg, var(--gs-accent), var(--gs-accent-hover))",
          color: "white",
        };
      default:
        return {
          background: "var(--gs-surface-inset)",
          color: "var(--gs-text-muted)",
        };
    }
  };

  const label = status === "hero_lock" ? "Hero Lock" : status;

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={getStyle(status)}
    >
      {label}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
