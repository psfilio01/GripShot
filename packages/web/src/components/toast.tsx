"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              onClick={() => dismiss(t.id)}
              className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm animate-[slideUp_200ms_ease-out]"
              style={toastStyle(t.type)}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function toastStyle(type: ToastType): React.CSSProperties {
  switch (type) {
    case "success":
      return {
        background: "var(--gs-success-bg)",
        color: "var(--gs-success-text)",
        border: "1px solid color-mix(in srgb, var(--gs-success-text) 30%, transparent)",
      };
    case "error":
      return {
        background: "var(--gs-error-bg)",
        color: "var(--gs-error-text)",
        border: "1px solid color-mix(in srgb, var(--gs-error-text) 30%, transparent)",
      };
    default:
      return {
        background: "var(--gs-surface-raised)",
        color: "var(--gs-text)",
        border: "1px solid var(--gs-border-subtle)",
      };
  }
}
