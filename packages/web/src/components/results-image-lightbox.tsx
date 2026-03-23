"use client";

import clsx from "clsx";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export interface ResultsLightboxItem {
  src: string;
  alt: string;
}

/** Viewport center of the thumbnail (px) — used for a Medium-style zoom-from-tile open. */
export type ResultsLightboxOrigin = { x: number; y: number };

/** Duration must match CSS carousel keyframes (globals.css). */
const SLIDE_CAROUSEL_MS = 420;

interface SlideTransition {
  from: number;
  to: number;
  dir: "next" | "prev";
}

interface ResultsImageLightboxProps {
  open: boolean;
  items: ResultsLightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  /** Set from click target rect; omit or null for keyboard open (centered origin). */
  openOriginCenter?: ResultsLightboxOrigin | null;
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SidePeekImage({
  side,
  item,
  disabled,
  onActivate,
  label,
}: {
  side: "left" | "right";
  item: ResultsLightboxItem;
  disabled: boolean;
  onActivate: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      className={clsx(
        "gs-results-lightbox-peek hidden min-[480px]:flex",
        side === "left" && "gs-results-lightbox-peek--left",
        side === "right" && "gs-results-lightbox-peek--right",
      )}
    >
      <span className="gs-results-lightbox-peek-frame">
        <img
          src={item.src}
          alt=""
          className="gs-results-lightbox-peek-img max-h-[min(48dvh,380px)] w-auto max-w-[min(22vw,168px)] object-contain md:max-h-[min(52dvh,440px)] md:max-w-[min(20vw,240px)]"
          draggable={false}
        />
      </span>
    </button>
  );
}

export function ResultsImageLightbox({
  open,
  items,
  index,
  onClose,
  onIndexChange,
  openOriginCenter = null,
}: ResultsImageLightboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(true);
  const [panelEnter, setPanelEnter] = useState(false);
  const [openedFresh, setOpenedFresh] = useState(false);
  /** Two-layer carousel: outgoing + incoming until timeout commits index */
  const [slide, setSlide] = useState<SlideTransition | null>(null);
  /** Remount caption so its enter animation runs on every open */
  const [captionSession, setCaptionSession] = useState(0);

  const len = items.length;
  const safeIndex = len === 0 ? 0 : Math.min(Math.max(0, index), len - 1);
  const current = len > 0 ? items[safeIndex] : null;
  const canNavigate = len > 1;
  const isSliding = slide !== null;
  const captionIndex = slide?.to ?? safeIndex;
  /** Neighbors for side peeks: anchor on target index while sliding */
  const neighborAnchor = slide?.to ?? safeIndex;
  const leftPeekIndex = canNavigate
    ? (neighborAnchor - 1 + len) % len
    : 0;
  const rightPeekIndex = canNavigate
    ? (neighborAnchor + 1) % len
    : 0;

  const goPrev = useCallback(() => {
    if (!canNavigate || isSliding) return;
    const to = (safeIndex - 1 + len) % len;
    setSlide({ from: safeIndex, to, dir: "prev" });
  }, [canNavigate, isSliding, len, safeIndex]);

  const goNext = useCallback(() => {
    if (!canNavigate || isSliding) return;
    const to = (safeIndex + 1) % len;
    setSlide({ from: safeIndex, to, dir: "next" });
  }, [canNavigate, isSliding, len, safeIndex]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (len > 0 && index >= len) {
      onIndexChange(len - 1);
    }
  }, [len, index, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  /** Close gallery on Escape; skip while react-medium-image-zoom modal is open (it handles Escape in capture phase). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-rmiz-modal][open]")) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSlide(null);
      return;
    }
    setSlide(null);
    setCaptionSession((s) => s + 1);
    setPanelEnter(true);
    setOpenedFresh(true);
    const tPanel = window.setTimeout(() => setPanelEnter(false), 520);
    const tFresh = window.setTimeout(() => setOpenedFresh(false), 480);
    return () => {
      window.clearTimeout(tPanel);
      window.clearTimeout(tFresh);
    };
  }, [open]);

  useEffect(() => {
    if (!slide) return;
    const t = window.setTimeout(() => {
      onIndexChange(slide.to);
      setSlide(null);
    }, SLIDE_CAROUSEL_MS);
    return () => window.clearTimeout(t);
  }, [slide, onIndexChange]);

  useEffect(() => {
    if (
      slide &&
      (slide.from >= len || slide.to >= len || slide.from < 0 || slide.to < 0)
    ) {
      setSlide(null);
    }
  }, [len, slide]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const applyOrigin = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      if (openOriginCenter) {
        const ox = openOriginCenter.x - r.left;
        const oy = openOriginCenter.y - r.top;
        panel.style.setProperty("--gs-lb-origin-x", `${ox}px`);
        panel.style.setProperty("--gs-lb-origin-y", `${oy}px`);
      } else {
        panel.style.setProperty("--gs-lb-origin-x", "50%");
        panel.style.setProperty("--gs-lb-origin-y", "50%");
      }
    };
    applyOrigin();
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(applyOrigin);
    });
    return () => {
      cancelAnimationFrame(outerId);
      if (innerId) cancelAnimationFrame(innerId);
    };
  }, [open, openOriginCenter]);

  useEffect(() => {
    setImgLoaded(false);
  }, [current?.src]);

  const handleBackdropClick = () => {
    onClose();
  };

  if (!open || len === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      className="gs-results-lightbox fixed inset-0 z-[110] m-0 max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0"
    >
      <div
        className={clsx(
          "gs-results-lightbox-inner flex min-h-[100dvh] min-w-[100vw] items-center justify-center p-3 sm:p-6 md:p-10",
        )}
        onClick={handleBackdropClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleBackdropClick();
        }}
        role="presentation"
      >
        <div
          ref={panelRef}
          className={clsx(
            "gs-results-lightbox-panel relative flex max-h-[90dvh] max-w-[min(100%,1400px)] flex-col items-center",
            panelEnter && "gs-results-lightbox-panel--enter",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="gs-results-lightbox-close absolute -right-1 -top-1 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-0 sm:top-0"
            aria-label="Close fullscreen view"
          >
            <CloseIcon />
          </button>

          <div className="relative flex w-full max-w-[min(100vw-0.5rem,1440px)] flex-col items-center px-0 sm:px-1">
            <div className="relative flex w-full flex-row items-center justify-center gap-0 py-2 min-[480px]:gap-2 min-[480px]:py-1 md:gap-4">
              {canNavigate && (
                <SidePeekImage
                  side="left"
                  item={items[leftPeekIndex]!}
                  disabled={isSliding}
                  onActivate={goPrev}
                  label="Previous image"
                />
              )}

              <div className="relative z-[10] mx-1 flex w-full min-w-0 max-w-[min(100%,min(88vw,860px))] flex-1 flex-col items-center min-[480px]:-mx-2 min-[480px]:px-1 md:-mx-5 md:px-0">
                {canNavigate && (
                  <>
                    <button
                      type="button"
                      disabled={isSliding}
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                      }}
                      className="gs-results-lightbox-nav gs-results-lightbox-nav--prev"
                      aria-label="Previous image"
                    >
                      <ChevronLeftIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                    <button
                      type="button"
                      disabled={isSliding}
                      onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                      }}
                      className="gs-results-lightbox-nav gs-results-lightbox-nav--next"
                      aria-label="Next image"
                    >
                      <ChevronRightIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                  </>
                )}

                <div
                  className="gs-results-lightbox-frame relative flex min-h-[120px] w-full min-w-[min(100%,280px)] items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl"
                  style={{
                    boxShadow:
                      "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.04) inset",
                  }}
                >
              {slide ? (
                <>
                  <div
                    className={clsx(
                      "gs-results-lightbox-slide-layer pointer-events-none absolute inset-0 z-[1] flex items-center justify-center",
                      slide.dir === "next" && "gs-results-lightbox-out--next",
                      slide.dir === "prev" && "gs-results-lightbox-out--prev",
                    )}
                    aria-hidden
                  >
                    <img
                      src={items[slide.from]?.src}
                      alt=""
                      className="max-h-[85dvh] w-auto max-w-full object-contain select-none"
                      draggable={false}
                    />
                  </div>
                  <div
                    className={clsx(
                      "gs-results-lightbox-slide-layer pointer-events-none absolute inset-0 z-[2] flex items-center justify-center",
                      slide.dir === "next" && "gs-results-lightbox-in--next",
                      slide.dir === "prev" && "gs-results-lightbox-in--prev",
                    )}
                  >
                    <img
                      src={items[slide.to]?.src}
                      alt={items[slide.to]?.alt ?? ""}
                      className="max-h-[85dvh] w-auto max-w-full object-contain select-none"
                      draggable={false}
                    />
                  </div>
                </>
              ) : (
                <>
                  {!imgLoaded && current && (
                    <div
                      className="absolute inset-0 z-[1] rounded-xl sm:rounded-2xl gs-results-lightbox-shimmer"
                      aria-hidden
                    />
                  )}
                  {current && (
                    <div
                      key={safeIndex}
                      className={clsx(
                        "gs-results-lightbox-img-hold relative z-[2] flex max-h-[85dvh] w-full items-center justify-center",
                        openedFresh &&
                          "gs-results-lightbox-img-hold--open-pop",
                      )}
                    >
                      <Zoom
                        key={current.src}
                        classDialog="gs-results-lightbox-rmiz-dialog"
                        a11yNameButtonZoom="Zoom image"
                        a11yNameButtonUnzoom="Minimize image"
                      >
                        <img
                          src={current.src}
                          alt={current.alt}
                          className="max-h-[85dvh] w-auto max-w-full object-contain"
                          onLoad={() => setImgLoaded(true)}
                          onError={() => setImgLoaded(true)}
                          draggable={false}
                        />
                      </Zoom>
                    </div>
                  )}
                </>
              )}
                </div>
              </div>

              {canNavigate && (
                <SidePeekImage
                  side="right"
                  item={items[rightPeekIndex]!}
                  disabled={isSliding}
                  onActivate={goNext}
                  label="Next image"
                />
              )}
            </div>
          </div>

          {canNavigate ? (
            <p
              key={captionSession}
              className="gs-results-lightbox-caption mt-4 text-center text-sm tabular-nums"
              style={{ color: "rgba(255,255,255,0.78)" }}
            >
              <span className="font-medium text-white/95">
                {captionIndex + 1}
              </span>
              <span className="mx-1 opacity-50">/</span>
              {len}
              <span className="mx-2 opacity-40">·</span>
              <span className="opacity-85">← →</span>
              <span className="ml-1 hidden sm:inline">to browse</span>
              <span className="ml-1 hidden min-[480px]:inline opacity-60">
                · side previews
              </span>
              <span className="mt-1 block text-xs font-normal opacity-65">
                Click the main image for medium-style zoom
              </span>
            </p>
          ) : (
            <p
              key={captionSession}
              className="gs-results-lightbox-caption mt-4 text-center text-xs"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Click the image for medium-style zoom
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Optional: shared props for grid thumbnails that open the lightbox */
export const resultsLightboxThumbClass =
  "cursor-zoom-in transition-[transform,opacity,box-shadow] duration-300 ease-out hover:opacity-95 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gs-accent)] focus-visible:ring-offset-2 active:scale-[0.99]";

export function resultsLightboxThumbKeyDown(
  e: ReactKeyboardEvent,
  open: () => void,
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    open();
  }
}
