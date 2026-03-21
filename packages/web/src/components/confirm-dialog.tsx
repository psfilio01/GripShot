"use client";

import { useCallback, useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClose={onCancel}
      className="fixed inset-0 z-[9999] m-auto max-w-sm w-full rounded-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--gs-surface-raised)",
        border: "1px solid var(--gs-border)",
        boxShadow: "var(--gs-shadow-lg)",
      }}
    >
      <div className="p-6 space-y-4">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--gs-text)" }}
        >
          {title}
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--gs-text-secondary)" }}
        >
          {message}
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
              variant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "gs-btn-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
