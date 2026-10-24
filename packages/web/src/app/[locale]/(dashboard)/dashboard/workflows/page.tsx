"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: { index: number }[];
}

interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  status: "draft" | "planned" | "in_progress" | "completed";
  totalSteps: number;
  completedSteps: number;
  createdAt: { _seconds: number };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
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

export default function WorkflowsPage() {
  const t = useTranslations("Workflows");
  const router = useRouter();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorkflows(data.workflows ?? []);
    } catch {
      toast(t("error"), "error");
    } finally {
      setLoaded(true);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreated = (workflowId: string) => {
    setModalOpen(false);
    router.push(`/dashboard/workflows/${workflowId}`);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t("statusDraft"),
      planned: t("statusPlanned"),
      in_progress: t("statusInProgress"),
      completed: t("statusCompleted"),
    };
    return map[status] ?? status;
  };

  const formatDate = (ts: { _seconds: number }) => {
    if (!ts?._seconds) return "—";
    return new Date(ts._seconds * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 gs-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--gs-text)" }}
          >
            {t("title")}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--gs-text-muted)" }}
          >
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTemplateModalOpen(true)}
            className="gs-btn-secondary px-4 py-2.5 text-sm"
          >
            {t("fromTemplate")}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="gs-btn-primary px-4 py-2.5 text-sm"
          >
            {t("newWorkflow")}
          </button>
        </div>
      </div>

      {/* List */}
      {workflows.length === 0 ? (
        <EmptyState
          icon="🔄"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={t("newWorkflow")}
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => {
            const colors = STATUS_COLORS[wf.status] ?? STATUS_COLORS.draft;
            return (
              <Link
                key={wf.id}
                href={`/dashboard/workflows/${wf.id}`}
                className="gs-card block p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[15px] font-semibold truncate"
                        style={{ color: "var(--gs-text)" }}
                      >
                        {wf.name}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: colors.bg,
                          color: colors.text,
                        }}
                      >
                        {statusLabel(wf.status)}
                      </span>
                    </div>
                    <p
                      className="mt-1 text-sm truncate"
                      style={{ color: "var(--gs-text-muted)" }}
                    >
                      {wf.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {wf.totalSteps > 0 && (
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--gs-text-secondary)" }}
                      >
                        {t("stepsProgress", {
                          completed: wf.completedSteps,
                          total: wf.totalSteps,
                        })}
                      </span>
                    )}
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: "var(--gs-text-muted)" }}
                    >
                      {formatDate(wf.createdAt)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateWorkflowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      {/* From Template Modal */}
      <FromTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Workflow Modal                                              */
/* ------------------------------------------------------------------ */

function CreateWorkflowModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("Workflows");
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [modelId, setModelId] = useState("");
  const [backgroundId, setBackgroundId] = useState("");
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setProductsLoading(true);
    void fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setProducts(
          Array.isArray(d?.products) ? d.products : [],
        ),
      )
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId.trim() || products.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          globalSettings: {
            productId: productId.trim(),
            ...(modelId.trim() ? { modelId: modelId.trim() } : {}),
            ...(backgroundId.trim()
              ? { backgroundId: backgroundId.trim() }
              : {}),
            ...(language.trim() ? { language: language.trim() } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setName("");
      setDescription("");
      setProductId("");
      setModelId("");
      setBackgroundId("");
      setLanguage("");
      onCreated(data.workflowId);
    } catch {
      toast(t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("createWorkflow")}
        </h2>

        {/* Name */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("name")}
          </label>
          <input
            className="gs-input w-full"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("description")}
          </label>
          <textarea
            className="gs-input w-full min-h-[80px] resize-y"
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={5000}
          />
        </div>

        {/* Product (required — same contract as Telegram / generation) */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("selectProduct")}{" "}
            <span style={{ color: "var(--gs-warning-text, #d97706)" }}>*</span>
          </label>
          <p
            className="text-xs"
            style={{ color: "var(--gs-text-muted)" }}
          >
            {t("productRequiredShort")}
          </p>
          {productsLoading ? (
            <div
              className="text-sm"
              style={{ color: "var(--gs-text-muted)" }}
            >
              …
            </div>
          ) : products.length === 0 ? (
            <div
              className="space-y-2 rounded-lg border p-3"
              style={{ borderColor: "var(--gs-border)" }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                {t("noProductsForWorkflow")}
              </p>
              <Link
                href="/dashboard/products"
                className="inline-block text-sm font-medium underline"
                style={{ color: "var(--gs-accent)" }}
              >
                {t("goToProducts")}
              </Link>
            </div>
          ) : (
            <select
              className="gs-input w-full"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">{t("selectProduct")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Global Settings */}
        <div className="space-y-3">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            {t("globalSettings")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label
                className="text-xs"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {t("model")}{" "}
                <span className="opacity-60">({t("optional")})</span>
              </label>
              <input
                className="gs-input w-full"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {t("background")}{" "}
                <span className="opacity-60">({t("optional")})</span>
              </label>
              <input
                className="gs-input w-full"
                value={backgroundId}
                onChange={(e) => setBackgroundId(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {t("language")}{" "}
                <span className="opacity-60">({t("optional")})</span>
              </label>
              <input
                className="gs-input w-full"
                placeholder="English"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              productsLoading ||
              !name.trim() ||
              !description.trim() ||
              !productId.trim() ||
              products.length === 0
            }
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {saving ? "…" : t("createWorkflow")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  From Template Modal                                               */
/* ------------------------------------------------------------------ */

function FromTemplateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("Workflows");
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setLoadingTemplates(true);
      setProductsLoading(true);
      void fetch("/api/workflow-templates")
        .then((r) => r.json())
        .then((data) => setTemplates(data.templates ?? []))
        .catch(() => {})
        .finally(() => setLoadingTemplates(false));
      void fetch("/api/products")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          setProducts(
            Array.isArray(d?.products) ? d.products : [],
          ),
        )
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false));
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setName(tmpl.name);
      setDescription(tmpl.description);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !productId.trim() || products.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          globalSettings: { productId: productId.trim() },
          fromTemplateId: selectedTemplateId,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedTemplateId("");
      setName("");
      setDescription("");
      setProductId("");
      onCreated(data.workflowId);
    } catch {
      toast(t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("createFromTemplate")}
        </h2>

        {/* Template selector */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("selectTemplate")}
          </label>
          {loadingTemplates ? (
            <div
              className="text-sm"
              style={{ color: "var(--gs-text-muted)" }}
            >
              …
            </div>
          ) : templates.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "var(--gs-text-muted)" }}
            >
              {t("noTemplates")}
            </p>
          ) : (
            <select
              className="gs-input w-full"
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              required
            >
              <option value="">{t("selectTemplate")}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}{" "}
                  {tmpl.steps?.length
                    ? `(${t("templateSteps", { count: tmpl.steps.length })})`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Name (pre-filled from template) */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("name")}
          </label>
          <input
            className="gs-input w-full"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        {/* Description (pre-filled from template) */}
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("description")}
          </label>
          <textarea
            className="gs-input w-full min-h-[80px] resize-y"
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={5000}
          />
        </div>

        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {t("selectProduct")}{" "}
            <span style={{ color: "var(--gs-warning-text, #d97706)" }}>*</span>
          </label>
          <p
            className="text-xs"
            style={{ color: "var(--gs-text-muted)" }}
          >
            {t("productRequiredShort")}
          </p>
          {productsLoading ? (
            <div
              className="text-sm"
              style={{ color: "var(--gs-text-muted)" }}
            >
              …
            </div>
          ) : products.length === 0 ? (
            <div
              className="space-y-2 rounded-lg border p-3"
              style={{ borderColor: "var(--gs-border)" }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                {t("noProductsForWorkflow")}
              </p>
              <Link
                href="/dashboard/products"
                className="inline-block text-sm font-medium underline"
                style={{ color: "var(--gs-accent)" }}
              >
                {t("goToProducts")}
              </Link>
            </div>
          ) : (
            <select
              className="gs-input w-full"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">{t("selectProduct")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              productsLoading ||
              !selectedTemplateId ||
              !name.trim() ||
              !description.trim() ||
              !productId.trim() ||
              products.length === 0
            }
            className="gs-btn-primary px-4 py-2 text-sm"
          >
            {saving ? "…" : t("createFromTemplate")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
