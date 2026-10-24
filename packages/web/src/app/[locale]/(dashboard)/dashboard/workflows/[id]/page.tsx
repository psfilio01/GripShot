"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useParams } from "next/navigation";
import {
  ResultsImageLightbox,
  resultsLightboxThumbClass,
  resultsLightboxThumbKeyDown,
  type ResultsLightboxOrigin,
} from "@/components/results-image-lightbox";
import { filePathToGeneratedImageUrl } from "@/lib/images/generated-public-url";
import {
  GENERATION_ASPECT_RATIOS,
  GENERATION_RESOLUTIONS,
} from "@/lib/generation/image-generation-params";
import { UI_SELECTABLE_GEMINI_IMAGE_MODEL_IDS } from "@/lib/generation/allowed-gemini-image-models";

/** Responsive step tiles: 1 / 2 / 3 / 4 columns by breakpoint. */
const WORKFLOW_STEPS_GRID_CLASS =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

const PENDING_TEXT_PLACEHOLDER = "[Text generation pending]";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StepColorVariant {
  colorId: string;
  colorName: string;
  colorHex: string;
  imagePath: string;
  status: "pending" | "completed" | "failed";
}

interface StepData {
  id: string;
  index: number;
  type: "image" | "text" | "image_with_text";
  title: string;
  description: string;
  promptConfig: Record<string, unknown>;
  status: "planned" | "generating" | "completed" | "failed";
  resultImagePath?: string;
  upscaledImagePath?: string;
  resultText?: string;
  resultImageDeletedAt?: { _seconds: number } | null;
  resultImageDeletedBy?: string | null;
  colorVariants?: StepColorVariant[];
}

/** Prefer 4K upscaled file for preview, lightbox, and browser "Save image as". */
function stepImagePathForDisplay(step: {
  resultImagePath?: string;
  upscaledImagePath?: string;
}): string | undefined {
  if (!step.resultImagePath) return undefined;
  return step.upscaledImagePath ?? step.resultImagePath;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  status: "draft" | "planned" | "in_progress" | "completed";
  globalSettings: {
    modelId?: string;
    backgroundId?: string;
    outfit?: string;
    language?: string;
    aspectRatio?: string;
    resolution?: string;
    imageModel?: string;
    productId?: string;
  };
}

interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

interface Product {
  id: string;
  name: string;
  colors?: ProductColor[];
}

interface HumanModelPick {
  id: string;
  displayName: string;
}

interface BackgroundPick {
  id: string;
  name: string;
}

function stepExpectsBundledImageText(step: StepData): boolean {
  return step.type === "image_with_text";
}

function stepShowsOptionalImageCopy(step: StepData): boolean {
  if (step.type !== "image") return false;
  const text = step.resultText?.trim();
  if (!text || text === PENDING_TEXT_PLACEHOLDER) return false;
  return true;
}

function shouldRenderCopyUnderImage(step: StepData): boolean {
  return stepExpectsBundledImageText(step) || stepShowsOptionalImageCopy(step);
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const WF_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: {
    bg: "color-mix(in srgb, var(--gs-text-muted) 15%, transparent)",
    text: "var(--gs-text-muted)",
  },
  planned: {
    bg: "color-mix(in srgb, var(--gs-accent) 15%, transparent)",
    text: "var(--gs-accent)",
  },
  in_progress: {
    bg: "color-mix(in srgb, var(--gs-warning-text, #d97706) 15%, transparent)",
    text: "var(--gs-warning-text, #d97706)",
  },
  completed: {
    bg: "color-mix(in srgb, var(--gs-success-text) 15%, transparent)",
    text: "var(--gs-success-text)",
  },
};

const STEP_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planned: {
    bg: "color-mix(in srgb, var(--gs-text-muted) 15%, transparent)",
    text: "var(--gs-text-muted)",
  },
  generating: {
    bg: "color-mix(in srgb, var(--gs-accent) 15%, transparent)",
    text: "var(--gs-accent)",
  },
  completed: {
    bg: "color-mix(in srgb, var(--gs-success-text) 15%, transparent)",
    text: "var(--gs-success-text)",
  },
  failed: {
    bg: "color-mix(in srgb, var(--gs-error-text) 15%, transparent)",
    text: "var(--gs-error-text)",
  },
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function WorkflowDetailPage() {
  const t = useTranslations("Workflows");
  const { toast } = useToast();
  const params = useParams();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [planning, setPlanning] = useState(false);
  const [busySteps, setBusySteps] = useState<Set<number>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [quotaDialog, setQuotaDialog] = useState<{
    needed: number;
    remaining: number;
    actionable: StepData[];
  } | null>(null);
  const [bundleDownloading, setBundleDownloading] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingGenDefaults, setSavingGenDefaults] = useState(false);
  const [humanModelsPick, setHumanModelsPick] = useState<HumanModelPick[]>([]);
  const [backgroundsPick, setBackgroundsPick] = useState<BackgroundPick[]>([]);
  const [runAspectRatio, setRunAspectRatio] = useState("4:5");
  const [runResolution, setRunResolution] = useState("2K");
  const [runImageModel, setRunImageModel] = useState("");
  const [runModelId, setRunModelId] = useState("");
  const [runBackgroundId, setRunBackgroundId] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOrigin, setLightboxOrigin] =
    useState<ResultsLightboxOrigin | null>(null);
  const [colorGenBusy, setColorGenBusy] = useState<Set<number>>(new Set());
  const [colorModalStep, setColorModalStep] = useState<StepData | null>(null);
  const [colorQuotaDialog, setColorQuotaDialog] = useState<{
    stepIndex: number;
    needed: number;
    remaining: number;
  } | null>(null);
  const [upscaleBusy, setUpscaleBusy] = useState<Set<number>>(new Set());
  const [batchUpscaling, setBatchUpscaling] = useState(false);

  const prefsRef = useRef({
    selectedProductId: "",
    runAspectRatio: "4:5",
    runResolution: "2K",
    runImageModel: "",
    runModelId: "",
    runBackgroundId: "",
  });
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    prefsRef.current = {
      selectedProductId,
      runAspectRatio,
      runResolution,
      runImageModel,
      runModelId,
      runBackgroundId,
    };
  }, [
    selectedProductId,
    runAspectRatio,
    runResolution,
    runImageModel,
    runModelId,
    runBackgroundId,
  ]);

  const flushPersistWorkflowPreferences = useCallback(async (): Promise<boolean> => {
    const p = prefsRef.current;
    const globalSettings: Record<string, string> = {
      aspectRatio: p.runAspectRatio,
      resolution: p.runResolution,
      imageModel: p.runImageModel.trim(),
      modelId: p.runModelId.trim(),
      backgroundId: p.runBackgroundId.trim(),
      productId: p.selectedProductId.trim(),
    };

    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalSettings }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.workflow) setWorkflow(data.workflow);
      return true;
    } catch {
      return false;
    }
  }, [workflowId]);

  const schedulePersistWorkflowPreferences = useCallback(() => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void flushPersistWorkflowPreferences();
    }, 450);
  }, [flushPersistWorkflowPreferences]);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, []);

  const stepsWithPreviewImages = useMemo(
    () =>
      steps.filter(
        (s) => s.status === "completed" && Boolean(s.resultImagePath),
      ),
    [steps],
  );

  const workflowLightboxItems = useMemo(
    () =>
      stepsWithPreviewImages.map((s) => ({
        src: filePathToGeneratedImageUrl(stepImagePathForDisplay(s)!),
        alt: s.title,
      })),
    [stepsWithPreviewImages],
  );

  const openWorkflowLightbox = useCallback(
    (stepId: string, origin: ResultsLightboxOrigin | null) => {
      const idx = stepsWithPreviewImages.findIndex((s) => s.id === stepId);
      if (idx < 0) return;
      setLightboxOrigin(origin);
      setLightboxIndex(idx);
      setLightboxOpen(true);
    },
    [stepsWithPreviewImages],
  );

  useEffect(() => {
    if (lightboxOpen && workflowLightboxItems.length === 0) {
      setLightboxOpen(false);
    }
  }, [lightboxOpen, workflowLightboxItems.length]);

  /* ---------- data fetching -------- */

  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorkflow(data.workflow);
      setSteps(data.steps ?? []);
      const gs = data.workflow?.globalSettings ?? {};
      setRunAspectRatio(gs.aspectRatio ?? "4:5");
      setRunResolution(gs.resolution ?? "1K");
      setRunImageModel(gs.imageModel ?? "");
      setRunModelId(gs.modelId ?? "");
      setRunBackgroundId(gs.backgroundId ?? "");
      setSelectedProductId(
        typeof gs.productId === "string" ? gs.productId : "",
      );
    } catch {
      toast(t("error"), "error");
    } finally {
      setLoaded(true);
    }
  }, [workflowId, toast, t]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) return;
      const data = await res.json();
      const prods: Product[] = data.products ?? [];
      for (const p of prods) {
        try {
          const cr = await fetch(`/api/products/${p.id}/colors`);
          if (cr.ok) {
            const cd = await cr.json();
            p.colors = cd.colors ?? [];
          }
        } catch { /* ignore */ }
      }
      setProducts(prods);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchWorkflow();
    fetchProducts();
  }, [fetchWorkflow, fetchProducts]);

  useEffect(() => {
    void fetch("/api/human-models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.models)
          setHumanModelsPick(
            d.models.map((m: { id: string; displayName: string }) => ({
              id: m.id,
              displayName: m.displayName,
            })),
          );
      })
      .catch(() => {});
    void fetch("/api/backgrounds")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.backgrounds)
          setBackgroundsPick(
            d.backgrounds.map((b: { id: string; name: string }) => ({
              id: b.id,
              name: b.name,
            })),
          );
      })
      .catch(() => {});
  }, []);

  /* ---------- actions -------------- */

  const handlePlan = async () => {
    setPlanning(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/plan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast(t("planSuccess"), "success");
      await fetchWorkflow();
    } catch {
      toast(t("error"), "error");
    } finally {
      setPlanning(false);
    }
  };

  const markBusy = (idx: number) =>
    setBusySteps((prev) => new Set(prev).add(idx));
  const unmarkBusy = (idx: number) =>
    setBusySteps((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });

  const executeStep = async (stepIndex: number) => {
    if (!selectedProductId) {
      toast(t("noProductSelected"), "error");
      return;
    }
    markBusy(stepIndex);
    setSteps((prev) =>
      prev.map((s) =>
        s.index === stepIndex ? { ...s, status: "generating" as const } : s,
      ),
    );
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: selectedProductId,
            aspectRatio: runAspectRatio,
            resolution: runResolution,
            ...(runImageModel.trim()
              ? { imageModel: runImageModel.trim() }
              : {}),
            ...(runModelId.trim() ? { modelId: runModelId.trim() } : {}),
            ...(runBackgroundId.trim()
              ? { backgroundId: runBackgroundId.trim() }
              : {}),
          }),
        },
      );
      if (!res.ok) throw new Error();
      toast(t("generateSuccess"), "success");
      await fetchWorkflow();
    } catch {
      toast(t("generateError"), "error");
      setSteps((prev) =>
        prev.map((s) =>
          s.index === stepIndex ? { ...s, status: "failed" as const } : s,
        ),
      );
    } finally {
      unmarkBusy(stepIndex);
    }
  };

  const replanStep = async (stepIndex: number) => {
    markBusy(stepIndex);
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/replan`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      toast(t("replanSuccess"), "success");
      await fetchWorkflow();
    } catch {
      toast(t("error"), "error");
    } finally {
      unmarkBusy(stepIndex);
    }
  };

  const deleteStepImage = async (stepIndex: number) => {
    markBusy(stepIndex);
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/image`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      toast("Image moved to trash", "success");
      await fetchWorkflow();
    } catch {
      toast(t("error"), "error");
    } finally {
      unmarkBusy(stepIndex);
    }
  };

  const restoreStepImageFn = async (stepIndex: number) => {
    markBusy(stepIndex);
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/image`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      toast("Image restored", "success");
      await fetchWorkflow();
    } catch {
      toast(t("error"), "error");
    } finally {
      unmarkBusy(stepIndex);
    }
  };

  const runBatch = async (actionable: StepData[]) => {
    setGeneratingAll(true);
    setBatchProgress({ current: 0, total: actionable.length });
    for (let i = 0; i < actionable.length; i++) {
      setBatchProgress({ current: i + 1, total: actionable.length });
      await executeStep(actionable[i].index);
    }
    setBatchProgress(null);
    setGeneratingAll(false);
    const fresh = await fetch(`/api/workflows/${workflowId}`).then((r) =>
      r.json(),
    );
    if (fresh.workflow?.status === "completed") {
      toast(t("allCompleted"), "success");
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedProductId) {
      toast(t("noProductSelected"), "error");
      return;
    }

    const actionable = steps.filter(
      (s) => s.status === "planned" || s.status === "failed",
    );
    if (actionable.length === 0) return;

    const imageCost = actionable.filter(
      (s) => s.type === "image" || s.type === "image_with_text",
    ).length;

    try {
      const quotaRes = await fetch("/api/billing/quota");
      if (quotaRes.ok) {
        const quota = await quotaRes.json();
        const remaining: number = quota.remaining ?? Infinity;
        if (imageCost > 0 && remaining !== Infinity) {
          setQuotaDialog({ needed: imageCost, remaining, actionable });
          return;
        }
      }
    } catch {
      /* proceed without quota check on network error */
    }

    await runBatch(actionable);
  };

  const handleQuotaConfirm = async () => {
    if (!quotaDialog) return;
    const { needed, remaining, actionable } = quotaDialog;
    setQuotaDialog(null);

    const stepsToRun =
      remaining < needed
        ? actionable.slice(0, remaining)
        : actionable;
    await runBatch(stepsToRun);
  };

  const handleBundleDownload = async () => {
    setBundleDownloading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/download`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "workflow.zip";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast(t("bundleDownloadError"), "error");
    } finally {
      setBundleDownloading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/save-as-template`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      toast(t("saveAsTemplateDone"), "success");
    } catch {
      toast(t("saveAsTemplateError"), "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveGenDefaults = async () => {
    setSavingGenDefaults(true);
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    try {
      const ok = await flushPersistWorkflowPreferences();
      if (!ok) throw new Error();
      toast(t("genDefaultsSaved"), "success");
    } catch {
      toast(t("genDefaultsError"), "error");
    } finally {
      setSavingGenDefaults(false);
    }
  };

  /* ---------- color generation ------ */

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );

  const productHasColors = (selectedProduct?.colors?.length ?? 0) > 0;

  const handleGenerateColors = async (stepIndex: number) => {
    if (!selectedProductId || !productHasColors) return;

    const colorCount = selectedProduct!.colors!.length;

    try {
      const quotaRes = await fetch("/api/billing/quota");
      if (quotaRes.ok) {
        const quota = await quotaRes.json();
        const remaining: number = quota.remaining ?? Infinity;
        if (remaining !== Infinity) {
          if (remaining < colorCount) {
            toast(
              t("colorsQuotaInsufficient", { needed: colorCount, remaining }),
              "error",
            );
            return;
          }
          setColorQuotaDialog({ stepIndex, needed: colorCount, remaining });
          return;
        }
      }
    } catch { /* proceed */ }

    await executeColorGeneration(stepIndex);
  };

  const executeColorGeneration = async (stepIndex: number) => {
    setColorGenBusy((prev) => new Set(prev).add(stepIndex));
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/hero-lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: selectedProductId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      const data = await res.json();
      const count = (data.colorVariants ?? []).filter(
        (v: StepColorVariant) => v.status === "completed",
      ).length;
      toast(t("colorsSuccess", { count }), "success");
      await fetchWorkflow();
    } catch {
      toast(t("colorsError"), "error");
    } finally {
      setColorGenBusy((prev) => {
        const next = new Set(prev);
        next.delete(stepIndex);
        return next;
      });
    }
  };

  const handleColorQuotaConfirm = async () => {
    if (!colorQuotaDialog) return;
    const { stepIndex } = colorQuotaDialog;
    setColorQuotaDialog(null);
    await executeColorGeneration(stepIndex);
  };

  /* ---------- upscale handlers -------- */

  const handleUpscaleStep = async (stepIndex: number) => {
    setUpscaleBusy((prev) => new Set(prev).add(stepIndex));
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${stepIndex}/upscale`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      toast(t("upscaleSuccess"), "success");
      await fetchWorkflow();
    } catch {
      toast(t("upscaleError"), "error");
    } finally {
      setUpscaleBusy((prev) => {
        const next = new Set(prev);
        next.delete(stepIndex);
        return next;
      });
    }
  };

  const handleBatchUpscale = async () => {
    setBatchUpscaling(true);
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/batch-upscale`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      const data = await res.json();
      if (data.upscaled === 0) {
        toast(t("batchUpscaleNone"), "info");
      } else {
        toast(t("batchUpscaleSuccess", { count: data.upscaled }), "success");
      }
      await fetchWorkflow();
    } catch {
      toast(t("batchUpscaleError"), "error");
    } finally {
      setBatchUpscaling(false);
    }
  };

  const hasUpscaleable = steps.some(
    (s) =>
      s.status === "completed" &&
      s.resultImagePath &&
      !s.resultImageDeletedAt &&
      !s.upscaledImagePath,
  );

  /* ---------- status labels -------- */

  const wfStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t("statusDraft"),
      planned: t("statusPlanned"),
      in_progress: t("statusInProgress"),
      completed: t("statusCompleted"),
    };
    return map[status] ?? status;
  };

  const stepStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      planned: t("stepPlanned"),
      generating: t("stepGenerating"),
      completed: t("stepCompleted"),
      failed: t("stepFailed"),
    };
    return map[status] ?? status;
  };

  const stepTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      image: t("typeImage"),
      text: t("typeText"),
      image_with_text: t("typeImageWithText"),
    };
    return map[type] ?? type;
  };

  /* ---------- loading state -------- */

  if (!loaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className={WORKFLOW_STEPS_GRID_CLASS}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="gs-card-static overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="p-2 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <EmptyState
        icon="🔍"
        title="Workflow not found"
        description=""
        actionLabel={t("back")}
        actionHref="/dashboard/workflows"
      />
    );
  }

  const completedCount = steps.filter(
    (s) => s.status === "completed",
  ).length;
  const allDone = steps.length > 0 && completedCount === steps.length;
  const wfColors = WF_STATUS_COLORS[workflow.status] ?? WF_STATUS_COLORS.draft;

  return (
    <div className="space-y-6 gs-fade-in">
      {/* Quota confirmation dialog */}
      {quotaDialog && (
        <QuotaDialog
          needed={quotaDialog.needed}
          remaining={quotaDialog.remaining}
          onConfirm={handleQuotaConfirm}
          onCancel={() => setQuotaDialog(null)}
          t={t}
        />
      )}

      {/* Color quota confirmation dialog */}
      {colorQuotaDialog && (
        <ColorQuotaDialog
          needed={colorQuotaDialog.needed}
          remaining={colorQuotaDialog.remaining}
          onConfirm={handleColorQuotaConfirm}
          onCancel={() => setColorQuotaDialog(null)}
          t={t}
        />
      )}

      {/* Color variants modal */}
      {colorModalStep && (
        <ColorVariantsModal
          step={colorModalStep}
          onClose={() => setColorModalStep(null)}
          t={t}
        />
      )}

      {/* Back */}
      <Link
        href="/dashboard/workflows"
        className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
        style={{ color: "var(--gs-text-muted)" }}
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        {t("back")}
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--gs-text)" }}
            >
              {workflow.name}
            </h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: wfColors.bg, color: wfColors.text }}
            >
              {wfStatusLabel(workflow.status)}
            </span>
            {batchProgress ? (
              <span
                className="text-sm font-medium"
                style={{ color: "var(--gs-accent)" }}
              >
                {t("batchProgress", {
                  current: batchProgress.current,
                  total: batchProgress.total,
                })}
              </span>
            ) : (
              steps.length > 0 && (
                <span
                  className="text-sm"
                  style={{ color: "var(--gs-text-secondary)" }}
                >
                  {t("stepsProgress", {
                    completed: completedCount,
                    total: steps.length,
                  })}
                </span>
              )
            )}
          </div>
          <p
            className="text-sm max-w-2xl"
            style={{ color: "var(--gs-text-muted)" }}
          >
            {workflow.description}
          </p>
          {/* Global settings chips */}
          <div className="flex flex-wrap gap-1.5">
            {workflow.globalSettings.language && (
              <SettingsChip
                label={t("language")}
                value={workflow.globalSettings.language}
              />
            )}
            {workflow.globalSettings.modelId && (
              <SettingsChip
                label={t("model")}
                value={workflow.globalSettings.modelId}
              />
            )}
            {workflow.globalSettings.backgroundId && (
              <SettingsChip
                label={t("background")}
                value={workflow.globalSettings.backgroundId}
              />
            )}
            {workflow.globalSettings.aspectRatio && (
              <SettingsChip
                label={t("aspectRatio")}
                value={workflow.globalSettings.aspectRatio}
              />
            )}
            {workflow.globalSettings.resolution && (
              <SettingsChip
                label={t("resolution")}
                value={workflow.globalSettings.resolution}
              />
            )}
            {workflow.globalSettings.imageModel && (
              <SettingsChip
                label={t("imageApiModel")}
                value={
                  workflow.globalSettings.imageModel ===
                  "gemini-3-pro-image-preview"
                    ? t("imageModelPro")
                    : t("imageModelFlash")
                }
              />
            )}
            {workflow.globalSettings.productId && (
              <SettingsChip
                label={t("savedProduct")}
                value={
                  products.find((p) => p.id === workflow.globalSettings.productId)
                    ?.name ?? workflow.globalSettings.productId
                }
              />
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Product selector */}
          <select
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              schedulePersistWorkflowPreferences();
            }}
            className="gs-input py-2 text-sm min-w-[160px]"
          >
            <option value="">{t("selectProduct")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {steps.length > 0 && (
            <button
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
              className="gs-btn-secondary px-4 py-2 text-sm"
            >
              {savingTemplate ? "…" : t("saveAsTemplate")}
            </button>
          )}

          {(workflow.status === "draft" ||
            workflow.status === "planned") && (
            <button
              onClick={handlePlan}
              disabled={planning}
              className="gs-btn-secondary px-4 py-2 text-sm"
            >
              {planning ? t("planning") : t("generatePlan")}
            </button>
          )}

          {steps.length > 0 && !allDone && (
            <button
              onClick={handleGenerateAll}
              disabled={!selectedProductId || generatingAll}
              className="gs-btn-primary px-4 py-2 text-sm"
            >
              {generatingAll ? t("stepGenerating") : t("generateAll")}
            </button>
          )}

          {allDone && (
            <button
              onClick={handleBundleDownload}
              disabled={bundleDownloading}
              className="gs-btn-primary px-4 py-2 text-sm"
            >
              {bundleDownloading ? t("bundleDownloading") : t("bundleDownload")}
            </button>
          )}

          {hasUpscaleable && (
            <button
              onClick={handleBatchUpscale}
              disabled={batchUpscaling}
              className="px-4 py-2 text-sm rounded-lg font-medium transition"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--gs-accent) 15%, transparent), color-mix(in srgb, #06b6d4 15%, transparent))",
                color: "var(--gs-accent-text)",
                border: "1px solid color-mix(in srgb, var(--gs-accent) 25%, transparent)",
              }}
            >
              {batchUpscaling ? t("batchUpscaling", { current: "…", total: "…" }) : t("batchUpscale")}
            </button>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <div
          className="gs-card-static p-4 space-y-3"
          style={{ borderColor: "var(--gs-border)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--gs-text)" }}
            >
              {t("genOptionsTitle")}
            </h2>
            <button
              type="button"
              onClick={() => void handleSaveGenDefaults()}
              disabled={savingGenDefaults}
              className="gs-btn-secondary px-3 py-1.5 text-xs shrink-0 self-start sm:self-auto"
            >
              {savingGenDefaults ? "…" : t("saveGenDefaults")}
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--gs-text-muted)" }}>
            {t("genOptionsHint")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: "var(--gs-text-secondary)" }}>
                {t("aspectRatio")}
              </span>
              <select
                value={runAspectRatio}
                onChange={(e) => {
                  setRunAspectRatio(e.target.value);
                  schedulePersistWorkflowPreferences();
                }}
                className="gs-input py-2 text-sm"
              >
                {GENERATION_ASPECT_RATIOS.map((ar) => (
                  <option key={ar} value={ar}>
                    {ar}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: "var(--gs-text-secondary)" }}>
                {t("resolution")}
              </span>
              <select
                value={runResolution}
                onChange={(e) => {
                  setRunResolution(e.target.value);
                  schedulePersistWorkflowPreferences();
                }}
                className="gs-input py-2 text-sm"
              >
                {GENERATION_RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: "var(--gs-text-secondary)" }}>
                {t("imageApiModel")}
              </span>
              <select
                value={runImageModel}
                onChange={(e) => {
                  setRunImageModel(e.target.value);
                  schedulePersistWorkflowPreferences();
                }}
                className="gs-input py-2 text-sm"
              >
                <option value="">{t("imageModelDefault")}</option>
                {UI_SELECTABLE_GEMINI_IMAGE_MODEL_IDS.map((mid) => (
                  <option key={mid} value={mid}>
                    {mid === "gemini-3-pro-image-preview"
                      ? t("imageModelPro")
                      : t("imageModelFlash")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: "var(--gs-text-secondary)" }}>
                {t("workflowHumanModel")}
              </span>
              <select
                value={runModelId}
                onChange={(e) => {
                  setRunModelId(e.target.value);
                  schedulePersistWorkflowPreferences();
                }}
                className="gs-input py-2 text-sm"
              >
                <option value="">{t("optionalNone")}</option>
                {humanModelsPick.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: "var(--gs-text-secondary)" }}>
                {t("workflowBackground")}
              </span>
              <select
                value={runBackgroundId}
                onChange={(e) => {
                  setRunBackgroundId(e.target.value);
                  schedulePersistWorkflowPreferences();
                }}
                className="gs-input py-2 text-sm"
              >
                <option value="">{t("optionalNone")}</option>
                {backgroundsPick.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Steps grid */}
      {steps.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t("noSteps")}
          description={t("noStepsDescription")}
          actionLabel={
            workflow.status === "draft" ? t("generatePlan") : undefined
          }
          onAction={workflow.status === "draft" ? handlePlan : undefined}
        />
      ) : (
        <div className={WORKFLOW_STEPS_GRID_CLASS}>
          {steps.map((step) => {
            const isBusy = busySteps.has(step.index);
            const isFullWidth = step.type === "text";
            const wrapperClass = isFullWidth ? "col-span-full" : "";

            switch (step.type) {
              case "image":
                return (
                  <ImageCard
                    key={step.id}
                    step={step}
                    busy={isBusy}
                    onGenerate={executeStep}
                    onReplan={replanStep}
                    onDeleteImage={deleteStepImage}
                    onRestoreImage={restoreStepImageFn}
                    statusLabel={stepStatusLabel}
                    className={wrapperClass}
                    onOpenImageLightbox={openWorkflowLightbox}
                    productHasColors={productHasColors}
                    colorGenBusy={colorGenBusy.has(step.index)}
                    onGenerateColors={handleGenerateColors}
                    onOpenColorModal={setColorModalStep}
                    upscaleBusy={upscaleBusy.has(step.index)}
                    onUpscale={handleUpscaleStep}
                    t={t}
                  />
                );
              case "text":
                return (
                  <TextCard
                    key={step.id}
                    step={step}
                    busy={isBusy}
                    onGenerate={executeStep}
                    onReplan={replanStep}
                    statusLabel={stepStatusLabel}
                    className={wrapperClass}
                    t={t}
                  />
                );
              case "image_with_text":
                return (
                  <ImageWithTextCard
                    key={step.id}
                    step={step}
                    busy={isBusy}
                    onGenerate={executeStep}
                    onReplan={replanStep}
                    statusLabel={stepStatusLabel}
                    typeLabel={stepTypeLabel}
                    className={wrapperClass}
                    onOpenImageLightbox={openWorkflowLightbox}
                    productHasColors={productHasColors}
                    colorGenBusy={colorGenBusy.has(step.index)}
                    onGenerateColors={handleGenerateColors}
                    onOpenColorModal={setColorModalStep}
                    upscaleBusy={upscaleBusy.has(step.index)}
                    onUpscale={handleUpscaleStep}
                    t={t}
                  />
                );
            }
          })}
        </div>
      )}

      <ResultsImageLightbox
        open={lightboxOpen && workflowLightboxItems.length > 0}
        items={workflowLightboxItems}
        index={lightboxIndex}
        openOriginCenter={lightboxOrigin}
        onClose={() => {
          setLightboxOpen(false);
          setLightboxOrigin(null);
        }}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

/* ================================================================== */
/*  Card components                                                    */
/* ================================================================== */

interface CardProps {
  step: StepData;
  busy: boolean;
  onGenerate: (idx: number) => void;
  onReplan: (idx: number) => void;
  onDeleteImage?: (idx: number) => void;
  onRestoreImage?: (idx: number) => void;
  statusLabel: (s: string) => string;
  className?: string;
  onOpenImageLightbox?: (
    stepId: string,
    origin: ResultsLightboxOrigin | null,
  ) => void;
  productHasColors?: boolean;
  colorGenBusy?: boolean;
  onGenerateColors?: (idx: number) => void;
  onOpenColorModal?: (step: StepData) => void;
  upscaleBusy?: boolean;
  onUpscale?: (idx: number) => void;
  t: ReturnType<typeof useTranslations>;
}

function GeneratedCopyUnderImage({
  step,
  t,
}: {
  step: StepData;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!shouldRenderCopyUnderImage(step)) return null;

  let content: string;
  if (stepShowsOptionalImageCopy(step)) {
    content = step.resultText!.trim();
  } else if (stepExpectsBundledImageText(step)) {
    if (step.status === "generating") content = t("stepGenerating");
    else if (step.status === "completed") {
      const rt = step.resultText?.trim() ?? "";
      if (rt && rt !== PENDING_TEXT_PLACEHOLDER) content = rt;
      else content = t("textPlaceholder");
    } else {
      content = t("textPlaceholder");
    }
  } else {
    return null;
  }

  return (
    <div
      className="border-t px-2 pt-1.5 pb-1"
      style={{ borderColor: "var(--gs-border)" }}
    >
      <p
        className="mb-1 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--gs-text-muted)" }}
      >
        {t("stepGeneratedCopy")}
      </p>
      <div
        className="max-h-28 overflow-y-auto rounded-md px-2 py-1.5 text-xs leading-snug whitespace-pre-wrap break-words"
        style={{
          background: "var(--gs-surface-inset)",
          color: "var(--gs-text)",
        }}
      >
        {content}
      </div>
    </div>
  );
}

/* ---------- IMAGE Card ---------- */

function ImageCard({
  step,
  busy,
  onGenerate,
  onReplan,
  onDeleteImage,
  onRestoreImage,
  statusLabel,
  className,
  onOpenImageLightbox,
  productHasColors,
  colorGenBusy,
  onGenerateColors,
  onOpenColorModal,
  upscaleBusy,
  onUpscale,
  t,
}: CardProps) {
  const colors =
    STEP_STATUS_COLORS[step.status] ?? STEP_STATUS_COLORS.planned;
  const imageDeleted = Boolean(step.resultImageDeletedAt);
  const completedColorCount = (step.colorVariants ?? []).filter(
    (v) => v.status === "completed",
  ).length;
  const isUpscaled = Boolean(step.upscaledImagePath);

  return (
    <div
      className={`gs-card group overflow-hidden flex flex-col min-w-0 ${className ?? ""}`}
      style={imageDeleted ? { opacity: 0.7 } : undefined}
    >
      <div
        className="relative h-40 w-full shrink-0"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {step.status === "planned" && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2">
            <ImagePlaceholderIcon />
            <span
              className="text-center text-[11px] leading-tight"
              style={{ color: "var(--gs-text-muted)" }}
            >
              {t("imagePlaceholder")}
            </span>
          </div>
        )}
        {step.status === "generating" && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="space-y-2 text-center">
              <SpinnerIcon />
              <span
                className="block text-[11px]"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {t("stepGenerating")}
              </span>
            </div>
          </div>
        )}
        {step.status === "completed" && step.resultImagePath && imageDeleted && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <span className="text-2xl">🗑️</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--gs-text-muted)" }}>
              In Papierkorb
            </span>
            {onRestoreImage && (
              <button
                onClick={() => onRestoreImage(step.index)}
                disabled={busy}
                className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition"
                style={{
                  background: "var(--gs-surface)",
                  color: "var(--gs-accent-text)",
                  border: "1px solid var(--gs-border)",
                }}
              >
                Wiederherstellen
              </button>
            )}
          </div>
        )}
        {step.status === "completed" && step.resultImagePath && !imageDeleted && (
          <>
            <img
              src={filePathToGeneratedImageUrl(stepImagePathForDisplay(step)!)}
              alt={step.title}
              className={`h-full w-full object-cover ${
                onOpenImageLightbox ? resultsLightboxThumbClass : ""
              }`}
              draggable={false}
              tabIndex={onOpenImageLightbox ? 0 : undefined}
              role={onOpenImageLightbox ? "button" : undefined}
              title={onOpenImageLightbox ? t("galleryZoomHint") : undefined}
              aria-label={
                onOpenImageLightbox ? t("openWorkflowGallery") : undefined
              }
              onClick={
                onOpenImageLightbox
                  ? (e: MouseEvent<HTMLImageElement>) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      onOpenImageLightbox(step.id, {
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                      });
                    }
                  : undefined
              }
              onKeyDown={
                onOpenImageLightbox
                  ? (e) =>
                      resultsLightboxThumbKeyDown(e, () =>
                        onOpenImageLightbox(step.id, null),
                      )
                  : undefined
              }
            />
            {onDeleteImage && (
              <button
                onClick={() => onDeleteImage(step.index)}
                disabled={busy}
                title="In Papierkorb"
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )}
            {completedColorCount > 0 && onOpenColorModal && (
              <button
                onClick={() => onOpenColorModal(step)}
                className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span>🎨</span>
                {t("colorsBadge", { count: completedColorCount })}
              </button>
            )}
            {isUpscaled && (
              <span
                className="absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  color: "#06b6d4",
                  backdropFilter: "blur(4px)",
                }}
              >
                {t("badge4k")}
              </span>
            )}
          </>
        )}
        {step.status === "failed" && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <ErrorIcon />
            <span
              className="text-[11px]"
              style={{ color: "var(--gs-error-text)" }}
            >
              {t("stepFailed")}
            </span>
          </div>
        )}
      </div>

      <GeneratedCopyUnderImage step={step} t={t} />

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="flex items-start justify-between gap-2">
          <span
            className="min-w-0 text-xs font-semibold leading-tight line-clamp-2"
            style={{ color: "var(--gs-text)" }}
          >
            {step.title}
          </span>
          <StepBadge label={statusLabel(step.status)} colors={colors} />
        </div>
        <p
          className="line-clamp-2 text-[11px] leading-snug"
          style={{ color: "var(--gs-text-muted)" }}
        >
          {step.description}
        </p>
        <StepActions
          step={step}
          busy={busy}
          onGenerate={onGenerate}
          onReplan={onReplan}
          productHasColors={productHasColors}
          colorGenBusy={colorGenBusy}
          onGenerateColors={onGenerateColors}
          upscaleBusy={upscaleBusy}
          onUpscale={onUpscale}
          t={t}
        />
      </div>
    </div>
  );
}

/* ---------- TEXT Card ---------- */

function TextCard({
  step,
  busy,
  onGenerate,
  onReplan,
  statusLabel,
  className,
  t,
}: CardProps) {
  const colors =
    STEP_STATUS_COLORS[step.status] ?? STEP_STATUS_COLORS.planned;

  return (
    <div
      className={`gs-card space-y-2 p-3 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TextIcon className="h-4 w-4" />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            {step.title}
          </span>
        </div>
        <StepBadge label={statusLabel(step.status)} colors={colors} />
      </div>

      <p
        className="text-xs"
        style={{ color: "var(--gs-text-muted)" }}
      >
        {step.description}
      </p>

      {/* Text content */}
      <div
        className="rounded-lg p-3 text-sm min-h-[80px]"
        style={{
          background: "var(--gs-surface-inset)",
          color:
            step.status === "completed"
              ? "var(--gs-text)"
              : "var(--gs-text-muted)",
        }}
      >
        {step.status === "completed" && step.resultText
          ? step.resultText
          : step.status === "generating"
            ? t("stepGenerating")
            : t("textPlaceholder")}
      </div>

      <StepActions
        step={step}
        busy={busy}
        onGenerate={onGenerate}
        onReplan={onReplan}
        t={t}
        showNewPose={false}
      />
    </div>
  );
}

/* ---------- IMAGE + TEXT Card ---------- */

function ImageWithTextCard({
  step,
  busy,
  onGenerate,
  onReplan,
  statusLabel,
  typeLabel,
  className,
  onOpenImageLightbox,
  productHasColors,
  colorGenBusy,
  onGenerateColors,
  onOpenColorModal,
  upscaleBusy,
  onUpscale,
  t,
}: CardProps & { typeLabel: (s: string) => string }) {
  const colors =
    STEP_STATUS_COLORS[step.status] ?? STEP_STATUS_COLORS.planned;
  const completedColorCount = (step.colorVariants ?? []).filter(
    (v) => v.status === "completed",
  ).length;

  return (
    <div
      className={`gs-card flex min-w-0 flex-col overflow-hidden ${className ?? ""}`}
    >
      <div
        className="relative h-40 w-full shrink-0"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {step.status === "planned" && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2">
            <ImagePlaceholderIcon />
            <span
              className="text-center text-[11px] leading-tight"
              style={{ color: "var(--gs-text-muted)" }}
            >
              {t("imagePlaceholder")}
            </span>
          </div>
        )}
        {step.status === "generating" && (
          <div className="flex h-full w-full items-center justify-center">
            <SpinnerIcon />
          </div>
        )}
        {step.status === "completed" && step.resultImagePath && (
          <>
            <img
              src={filePathToGeneratedImageUrl(stepImagePathForDisplay(step)!)}
              alt={step.title}
              className={`h-full w-full object-cover ${
                onOpenImageLightbox ? resultsLightboxThumbClass : ""
              }`}
              draggable={false}
              tabIndex={onOpenImageLightbox ? 0 : undefined}
              role={onOpenImageLightbox ? "button" : undefined}
              title={onOpenImageLightbox ? t("galleryZoomHint") : undefined}
              aria-label={
                onOpenImageLightbox ? t("openWorkflowGallery") : undefined
              }
              onClick={
                onOpenImageLightbox
                  ? (e: MouseEvent<HTMLImageElement>) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      onOpenImageLightbox(step.id, {
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                      });
                    }
                  : undefined
              }
              onKeyDown={
                onOpenImageLightbox
                  ? (e) =>
                      resultsLightboxThumbKeyDown(e, () =>
                        onOpenImageLightbox(step.id, null),
                      )
                  : undefined
              }
            />
            {completedColorCount > 0 && onOpenColorModal && (
              <button
                onClick={() => onOpenColorModal(step)}
                className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span>🎨</span>
                {t("colorsBadge", { count: completedColorCount })}
              </button>
            )}
          </>
        )}
        {step.status === "failed" && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <ErrorIcon />
          </div>
        )}
      </div>

      <GeneratedCopyUnderImage step={step} t={t} />

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <span
              className="line-clamp-2 text-xs font-semibold leading-tight"
              style={{ color: "var(--gs-text)" }}
            >
              {step.title}
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
              style={{
                background:
                  "color-mix(in srgb, var(--gs-accent) 10%, transparent)",
                color: "var(--gs-accent)",
              }}
            >
              {typeLabel(step.type)}
            </span>
          </div>
          <StepBadge label={statusLabel(step.status)} colors={colors} />
        </div>

        <p
          className="line-clamp-2 text-[11px] leading-snug"
          style={{ color: "var(--gs-text-muted)" }}
        >
          {step.description}
        </p>

        <StepActions
          step={step}
          busy={busy}
          onGenerate={onGenerate}
          onReplan={onReplan}
          productHasColors={productHasColors}
          colorGenBusy={colorGenBusy}
          onGenerateColors={onGenerateColors}
          upscaleBusy={upscaleBusy}
          onUpscale={onUpscale}
          t={t}
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Shared sub-components                                              */
/* ================================================================== */

function StepBadge({
  label,
  colors,
}: {
  label: string;
  colors: { bg: string; text: string };
}) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

function StepActions({
  step,
  busy,
  onGenerate,
  onReplan,
  t,
  showNewPose = true,
  productHasColors,
  colorGenBusy,
  onGenerateColors,
  upscaleBusy,
  onUpscale,
}: {
  step: StepData;
  busy: boolean;
  onGenerate: (idx: number) => void;
  onReplan: (idx: number) => void;
  t: ReturnType<typeof useTranslations>;
  showNewPose?: boolean;
  productHasColors?: boolean;
  colorGenBusy?: boolean;
  onGenerateColors?: (idx: number) => void;
  upscaleBusy?: boolean;
  onUpscale?: (idx: number) => void;
}) {
  const showColorBtn =
    step.status === "completed" &&
    step.resultImagePath &&
    !step.resultImageDeletedAt &&
    productHasColors &&
    onGenerateColors;

  const showUpscaleBtn =
    step.status === "completed" &&
    step.resultImagePath &&
    !step.resultImageDeletedAt &&
    !step.upscaledImagePath &&
    onUpscale;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {step.status === "planned" && (
        <>
          <button
            onClick={() => onGenerate(step.index)}
            disabled={busy}
            className="gs-btn-primary px-3 py-1.5 text-xs"
          >
            {busy ? "…" : t("generate")}
          </button>
          {showNewPose && (
            <button
              onClick={() => onReplan(step.index)}
              disabled={busy}
              className="gs-btn-secondary px-3 py-1.5 text-xs"
            >
              {t("newPose")}
            </button>
          )}
        </>
      )}
      {step.status === "completed" && (
        <>
          <button
            onClick={() => onGenerate(step.index)}
            disabled={busy}
            className="gs-btn-secondary px-3 py-1.5 text-xs"
          >
            {busy ? "…" : t("regenerate")}
          </button>
          {showNewPose && (
            <button
              onClick={() => onReplan(step.index)}
              disabled={busy}
              className="gs-btn-secondary px-3 py-1.5 text-xs"
            >
              {t("newPose")}
            </button>
          )}
          {showColorBtn && (
            <button
              onClick={() => onGenerateColors(step.index)}
              disabled={colorGenBusy}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--gs-accent) 15%, transparent), color-mix(in srgb, #e879f9 15%, transparent))",
                color: "var(--gs-accent-text)",
                border: "1px solid color-mix(in srgb, var(--gs-accent) 25%, transparent)",
              }}
            >
              {colorGenBusy ? t("colorsGenerating") : t("generateColors")}
            </button>
          )}
          {showUpscaleBtn && (
            <button
              onClick={() => onUpscale(step.index)}
              disabled={upscaleBusy}
              className="px-3 py-1.5 text-xs rounded-lg font-medium transition"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, #06b6d4 15%, transparent), color-mix(in srgb, var(--gs-accent) 10%, transparent))",
                color: "#06b6d4",
                border: "1px solid color-mix(in srgb, #06b6d4 25%, transparent)",
              }}
            >
              {upscaleBusy ? t("upscaling") : t("upscale4k")}
            </button>
          )}
        </>
      )}
      {step.status === "failed" && (
        <button
          onClick={() => onGenerate(step.index)}
          disabled={busy}
          className="gs-btn-primary px-3 py-1.5 text-xs"
        >
          {busy ? "…" : t("retry")}
        </button>
      )}
    </div>
  );
}

function SettingsChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        background:
          "color-mix(in srgb, var(--gs-accent) 8%, transparent)",
        color: "var(--gs-text-secondary)",
      }}
    >
      <span style={{ color: "var(--gs-text-muted)" }}>{label}:</span>
      {value}
    </span>
  );
}

/* ================================================================== */
/*  Quota Dialog                                                       */
/* ================================================================== */

function QuotaDialog({
  needed,
  remaining,
  onConfirm,
  onCancel,
  t,
}: {
  needed: number;
  remaining: number;
  onConfirm: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const isInsufficient = remaining < needed;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-sm rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <div className="p-6 space-y-4">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("batchQuotaTitle")}
        </h2>
        <p className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
          {isInsufficient
            ? t("batchQuotaInsufficient", { needed, remaining })
            : t("batchQuotaEnough", { needed, remaining })}
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {t("batchQuotaCancel")}
          </button>
          <button
            onClick={onConfirm}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {t("batchQuotaConfirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ================================================================== */
/*  Color Quota Dialog                                                 */
/* ================================================================== */

function ColorQuotaDialog({
  needed,
  remaining,
  onConfirm,
  onCancel,
  t,
}: {
  needed: number;
  remaining: number;
  onConfirm: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-sm rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <div className="p-6 space-y-4">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("colorsQuotaTitle")}
        </h2>
        <p className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
          {t("colorsQuotaMessage", { needed, remaining })}
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {t("colorsQuotaCancel")}
          </button>
          <button
            onClick={onConfirm}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {t("colorsQuotaConfirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ================================================================== */
/*  Color Variants Modal                                               */
/* ================================================================== */

function ColorVariantsModal({
  step,
  onClose,
  t,
}: {
  step: StepData;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const variants = (step.colorVariants ?? []).filter(
    (v) => v.status === "completed",
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const downloadSingle = async (v: StepColorVariant) => {
    try {
      const url = filePathToGeneratedImageUrl(v.imagePath);
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      const ext = v.imagePath.split(".").pop() ?? "png";
      a.download = `${v.colorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* ignore */
    }
  };

  const downloadAll = async () => {
    for (const v of variants) {
      await downloadSingle(v);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--gs-text)" }}
          >
            {t("colorsModalTitle", { step: step.index + 1 })}
          </h2>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: "var(--gs-text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {variants.map((v) => (
            <div
              key={v.colorId}
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--gs-surface-inset)",
                border: "1px solid var(--gs-border)",
              }}
            >
              <img
                src={filePathToGeneratedImageUrl(v.imagePath)}
                alt={v.colorName}
                className="w-full aspect-square object-cover"
                draggable={false}
              />
              <div className="p-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: v.colorHex,
                      borderColor: "var(--gs-border)",
                    }}
                  />
                  <span
                    className="text-[11px] font-medium truncate"
                    style={{ color: "var(--gs-text)" }}
                  >
                    {v.colorName}
                  </span>
                </div>
                <button
                  onClick={() => downloadSingle(v)}
                  className="shrink-0 rounded p-1 transition-colors hover:bg-black/5"
                  title={t("colorDownload")}
                >
                  <svg className="h-3.5 w-3.5" style={{ color: "var(--gs-text-muted)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={downloadAll}
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {t("colorsModalDownloadAll")}
          </button>
          <button
            onClick={onClose}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {t("colorsModalClose")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function ArrowLeftIcon({ className }: { className?: string }) {
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
        d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
      />
    </svg>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg
      className="h-10 w-10"
      style={{ color: "var(--gs-text-muted)", opacity: 0.4 }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  );
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      style={{ color: "var(--gs-text-muted)" }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-8 w-8 animate-spin"
      style={{ color: "var(--gs-accent)" }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="h-10 w-10"
      style={{ color: "var(--gs-error-text)", opacity: 0.6 }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}
