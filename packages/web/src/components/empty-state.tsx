"use client";

import { Link } from "@/i18n/navigation";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = "📦",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gs-fade-in">
      <span className="text-5xl mb-4" role="img" aria-hidden>
        {icon}
      </span>
      <h3
        className="text-lg font-bold"
        style={{ color: "var(--gs-text)" }}
      >
        {title}
      </h3>
      <p
        className="mt-2 max-w-sm text-sm leading-relaxed"
        style={{ color: "var(--gs-text-muted)" }}
      >
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="gs-btn-primary mt-6 px-5 py-2.5 text-sm"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="gs-btn-primary mt-6 px-5 py-2.5 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
