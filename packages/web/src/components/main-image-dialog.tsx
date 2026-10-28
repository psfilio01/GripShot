"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export interface MainImageInfo {
  sourceVariantId: string;
  sourceSha256: string;
  preserveShadow: boolean;
  reviewed: boolean;
  metrics?: Record<string, unknown>;
}

/** A local composite is a draft until a person has checked the semantic mask. */
export function MainImageDialog({
  sourceUrl,
  resultUrl,
  reviewed = false,
  warnings = [],
  busy,
  onCreate,
  onReview,
  onClose,
}: {
  sourceUrl?: string;
  resultUrl?: string;
  reviewed?: boolean;
  warnings?: string[];
  busy: boolean;
  onCreate: (preserveShadow: boolean) => void;
  onReview: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("MainImage");
  const dialog = useRef<HTMLDialogElement>(null);
  const [preserveShadow, setPreserveShadow] = useState(true);
  const [inspected, setInspected] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="main-image-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 z-[9999] m-auto w-[calc(100%_-_2rem)] max-w-5xl max-h-[92dvh] overflow-auto rounded-2xl p-6 backdrop:bg-black/60"
      style={{ background: "var(--gs-surface-raised)", color: "var(--gs-text)" }}
    >
      <div className="space-y-4">
        <h2 id="main-image-title" className="text-lg font-bold">
          {t(resultUrl ? "reviewTitle" : "createTitle")}
        </h2>
        <p className="text-sm" style={{ color: "var(--gs-text-secondary)" }}>
          {t(resultUrl ? "reviewDescription" : "createDescription")}
        </p>
        <div className={resultUrl ? "grid gap-4 sm:grid-cols-2" : "mx-auto max-w-md"}>
          <figure>
            <figcaption className="mb-2 text-sm font-medium">{t("original")}</figcaption>
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noreferrer" title={t("openFullSize")}>
                <img src={sourceUrl} alt={t("original")} className="max-h-[50dvh] w-full object-contain rounded-lg" />
              </a>
            ) : (
              <p className="text-sm">{t("sourceMissing")}</p>
            )}
          </figure>
          {resultUrl && (
            <figure>
              <figcaption className="mb-2 text-sm font-medium">{t("result")}</figcaption>
              <a href={resultUrl} target="_blank" rel="noreferrer" title={t("openFullSize")}>
                <img src={resultUrl} alt={t("result")} className="max-h-[50dvh] w-full object-contain rounded-lg bg-white" />
              </a>
            </figure>
          )}
        </div>
        {!resultUrl && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={preserveShadow} onChange={(e) => setPreserveShadow(e.target.checked)} disabled={busy} />
            <span>{t("preserveShadow")}<span className="mt-1 block text-xs" style={{ color: "var(--gs-text-muted)" }}>{t("shadowHint")}</span></span>
          </label>
        )}
        <p className="rounded-lg p-3 text-xs" style={{ background: "var(--gs-surface-inset)", color: "var(--gs-text-muted)" }}>
          {t(resultUrl ? "checkLimit" : "scopeHint")}
        </p>
        {warnings.filter((warning) => !warning.startsWith("Automatic segmentation")).map((warning) => (
          <p key={warning} className="text-sm" role="status" style={{ color: "var(--gs-accent-text)" }}>{warning}</p>
        ))}
        {resultUrl && !reviewed && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={inspected} onChange={(e) => setInspected(e.target.checked)} disabled={busy} />
            {t("confirmInspection")}
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="gs-btn-secondary px-4 py-2 text-sm">{t("close")}</button>
          {(!resultUrl || !reviewed) && (
            <button
              type="button"
              onClick={() => resultUrl ? onReview() : onCreate(preserveShadow)}
              disabled={busy || (!!resultUrl && !inspected)}
              className="gs-btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {t(busy ? "working" : resultUrl ? "approve" : "start")}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
