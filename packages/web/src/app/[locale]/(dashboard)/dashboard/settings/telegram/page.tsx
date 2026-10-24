"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast";

export default function TelegramSettingsPage() {
  const t = useTranslations("TelegramSettings");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [linked, setLinked] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) {
        const data = await res.json();
        setLinked(data.linked);
        setChatId(data.chatId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) return;

    let cancelled = false;

    (async () => {
      setLinking(true);
      try {
        const res = await fetch("/api/telegram/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setLinked(true);
            setChatId(data.chatId);
            toast(t("linkSuccess"), "success");
          } else {
            const err = await res.json().catch(() => ({}));
            toast(
              err.error === "Invalid or expired token"
                ? t("linkExpired")
                : t("linkFailed"),
              "error",
            );
          }
        }
      } catch {
        if (!cancelled) toast(t("linkFailed"), "error");
      } finally {
        if (!cancelled) setLinking(false);
        router.replace("/dashboard/settings/telegram", { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      if (res.ok) {
        setLinked(false);
        setChatId(null);
        toast(t("unlinkSuccess"), "success");
      } else {
        toast(t("unlinkFailed"), "error");
      }
    } catch {
      toast(t("unlinkFailed"), "error");
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          {t("title")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          {t("subtitle")}
        </p>
      </div>

      <section className="gs-card-static p-6">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("statusTitle")}
        </h2>

        {loading || linking ? (
          <div
            className="mt-4 text-sm animate-pulse"
            style={{ color: "var(--gs-text-faint)" }}
          >
            {linking ? t("linking") : "Loading…"}
          </div>
        ) : linked ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "var(--gs-success-text)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--gs-text)" }}
              >
                {t("connected")}
              </span>
              {chatId && (
                <span
                  className="text-xs"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  Chat ID: {chatId}
                </span>
              )}
            </div>
            <p
              className="text-sm"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              {t("connectedHint")}
            </p>
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="gs-btn-secondary px-4 py-2 text-sm"
            >
              {unlinking ? t("unlinking") : t("unlink")}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "var(--gs-text-faint)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--gs-text)" }}
              >
                {t("notConnected")}
              </span>
            </div>
            <p
              className="text-sm"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              {t("notConnectedHint")}
            </p>
          </div>
        )}
      </section>

      <section className="gs-card-static p-6">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          {t("howItWorksTitle")}
        </h2>
        <ol
          className="mt-3 list-decimal list-inside space-y-2 text-sm"
          style={{ color: "var(--gs-text-secondary)" }}
        >
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
      </section>
    </div>
  );
}
