"use client";

/**
 * Results grid placeholder while an image job is running or after a failed attempt.
 */
export function GenerationPlaceholderCard({
  title,
  subtitle,
  variant,
  onDismiss,
  footer,
}: {
  title: string;
  subtitle: string;
  variant: "running" | "failed";
  onDismiss?: () => void;
  /** e.g. product name + workflow */
  footer?: string;
}) {
  return (
    <div
      className="gs-card overflow-hidden flex flex-col"
      style={
        variant === "failed"
          ? {
              borderColor: "color-mix(in srgb, var(--gs-error-text) 35%, var(--gs-border))",
            }
          : undefined
      }
    >
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 aspect-[4/5]"
        style={{
          background:
            variant === "running"
              ? "linear-gradient(180deg, var(--gs-surface-inset) 0%, var(--gs-surface) 100%)"
              : "var(--gs-error-bg)",
        }}
      >
        {variant === "running" ? (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--gs-surface)",
              boxShadow: "var(--gs-shadow-sm)",
            }}
          >
            <svg
              className="h-7 w-7 animate-pulse"
              style={{ color: "var(--gs-accent)" }}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9.813 15.904 9.503-9.503M9.813 15.904l-2.846-.813a4.5 4.5 0 0 1-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9.813 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
              />
            </svg>
          </div>
        ) : (
          <span className="text-2xl" aria-hidden>
            ⚠️
          </span>
        )}
        <div className="text-center space-y-1">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            {title}
          </p>
          <p
            className="text-xs leading-relaxed max-w-[14rem] mx-auto"
            style={{ color: "var(--gs-text-muted)" }}
          >
            {subtitle}
          </p>
        </div>
      </div>
      {variant === "running" && (
        <div className="px-3 pb-3 pt-0">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--gs-surface-inset)" }}
          >
            <div className="gs-indeterminate-bar" />
          </div>
        </div>
      )}
      {footer && (
        <div
          className="px-3 pb-2 pt-1 border-t"
          style={{ borderColor: "var(--gs-border-subtle)" }}
        >
          <p
            className="text-xs truncate"
            style={{ color: "var(--gs-text-muted)" }}
            title={footer}
          >
            {footer}
          </p>
        </div>
      )}
      {variant === "failed" && onDismiss && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onDismiss}
            className="gs-btn-secondary w-full py-2 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
