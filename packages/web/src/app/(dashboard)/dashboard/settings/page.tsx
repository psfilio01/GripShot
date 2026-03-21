"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/toast";

interface QuotaData {
  plan: string;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const PLAN_PRICES: Record<string, string> = {
  free: "€0/mo",
  starter: "€29/mo",
  pro: "€79/mo",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managing, setManaging] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const { toast } = useToast();

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/quota");
      if (res.ok) {
        setQuota(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  useEffect(() => {
    const billing = searchParams.get("billing");
    if (billing === "success") {
      toast("Payment successful! Your account has been updated.", "success");
      router.replace("/dashboard/settings", { scroll: false });
    } else if (billing === "cancelled") {
      toast("Checkout was cancelled. You can upgrade anytime.", "info");
      router.replace("/dashboard/settings", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade(priceId: string) {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
    } finally {
      setUpgrading(false);
    }
  }

  const CREDIT_PACK_PRICE_IDS: Record<string, string> = {
    "credits-100": process.env.NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID ?? "",
    "credits-500": process.env.NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID ?? "",
    "credits-1500": process.env.NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID ?? "",
  };

  async function handleBuyCredits(packId: string) {
    const priceId = CREDIT_PACK_PRICE_IDS[packId];
    if (!priceId) {
      toast("Credit pack not configured. Set the Stripe price ID in .env.", "error");
      return;
    }
    setBuyingCredits(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          mode: "payment",
          creditPackId: packId,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Credit purchase failed:", err);
      toast("Failed to start checkout", "error");
    } finally {
      setBuyingCredits(false);
    }
  }

  async function handleManageSubscription() {
    setManaging(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal redirect failed:", err);
    } finally {
      setManaging(false);
    }
  }

  const usagePercent =
    quota && quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0;

  return (
    <div className="max-w-3xl space-y-6 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Manage your account, plan, and usage.
        </p>
      </div>

      {/* Account */}
      <section className="gs-card-static p-6">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          Account
        </h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
              Email
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              {user?.email ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
              Display name
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              {user?.displayName ?? "—"}
            </span>
          </div>
        </div>
      </section>

      {/* Plan & Usage */}
      <section className="gs-card-static p-6">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          Plan &amp; Usage
        </h2>

        {loading ? (
          <div
            className="mt-4 text-sm animate-pulse"
            style={{ color: "var(--gs-text-faint)" }}
          >
            Loading…
          </div>
        ) : quota ? (
          <div className="mt-4 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="text-xl font-bold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {PLAN_LABELS[quota.plan] ?? quota.plan}
                </span>
                <span
                  className="ml-2 text-sm"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  {PLAN_PRICES[quota.plan] ?? ""}
                </span>
              </div>
              {quota.plan === "free" ? (
                <button
                  onClick={() =>
                    handleUpgrade(
                      process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
                    )
                  }
                  disabled={upgrading}
                  className="gs-btn-primary px-4 py-2 text-sm"
                >
                  {upgrading ? "Redirecting…" : "Upgrade to Starter"}
                </button>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  disabled={managing}
                  className="gs-btn-secondary px-4 py-2 text-sm"
                >
                  {managing ? "Redirecting…" : "Manage Subscription"}
                </button>
              )}
            </div>

            <div>
              <div
                className="flex justify-between text-xs mb-1.5"
                style={{ color: "var(--gs-text-muted)" }}
              >
                <span>Credits used this period</span>
                <span>
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div
                className="h-2 w-full rounded-full"
                style={{ background: "var(--gs-surface-inset)" }}
              >
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${usagePercent}%`,
                    backgroundColor:
                      usagePercent >= 90
                        ? "var(--gs-error-text)"
                        : usagePercent >= 70
                          ? "var(--gs-warning-text)"
                          : "var(--gs-accent)",
                  }}
                />
              </div>
              {usagePercent >= 90 && (
                <p
                  className="mt-2 text-xs"
                  style={{ color: "var(--gs-error-text)" }}
                >
                  You&apos;re running low on credits.{" "}
                  {quota.plan === "free"
                    ? "Upgrade to get more."
                    : "Credits reset next billing cycle."}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <CreditCard label="Used" value={quota.used} />
              <CreditCard label="Remaining" value={quota.remaining} />
              <CreditCard label="Limit" value={quota.limit} />
            </div>
          </div>
        ) : (
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--gs-text-faint)" }}
          >
            Could not load plan information.
          </p>
        )}
      </section>

      {/* Credit Top-Up */}
      {quota && (
        <section className="gs-card-static p-6">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            Buy Extra Credits
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--gs-text-muted)" }}
          >
            Need more credits before your next billing cycle? Top up instantly.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CreditPackCard
              name="100 Credits"
              price="€9"
              savings=""
              onBuy={() => handleBuyCredits("credits-100")}
              buying={buyingCredits}
            />
            <CreditPackCard
              name="500 Credits"
              price="€39"
              savings="Save 13%"
              onBuy={() => handleBuyCredits("credits-500")}
              buying={buyingCredits}
              highlighted
            />
            <CreditPackCard
              name="1,500 Credits"
              price="€99"
              savings="Save 27%"
              onBuy={() => handleBuyCredits("credits-1500")}
              buying={buyingCredits}
            />
          </div>
        </section>
      )}

      {/* Plan Comparison */}
      {quota?.plan === "free" && (
        <section className="gs-card-static p-6">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            Compare Plans
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <PlanCard
              name="Free"
              price="€0/mo"
              features={["50 credits/month", "1 brand", "3 products"]}
              current
            />
            <PlanCard
              name="Starter"
              price="€29/mo"
              features={[
                "500 credits/month",
                "3 brands",
                "20 products",
                "All generation types",
              ]}
              onUpgrade={() =>
                handleUpgrade(
                  process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
                )
              }
              upgrading={upgrading}
            />
            <PlanCard
              name="Pro"
              price="€79/mo"
              features={[
                "2,000 credits/month",
                "Unlimited brands & products",
                "A+ content workflows",
                "Priority support",
              ]}
              onUpgrade={() =>
                handleUpgrade(
                  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
                )
              }
              upgrading={upgrading}
              highlighted
            />
          </div>
        </section>
      )}
    </div>
  );
}

function CreditCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{
        background: "var(--gs-surface-inset)",
        border: "1px solid var(--gs-border-subtle)",
      }}
    >
      <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold"
        style={{ color: "var(--gs-text)" }}
      >
        {value}
      </p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted,
  onUpgrade,
  upgrading,
}: {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
  highlighted?: boolean;
  onUpgrade?: () => void;
  upgrading?: boolean;
}) {
  return (
    <div
      className="gs-card-static p-4"
      style={
        highlighted
          ? {
              borderColor: "var(--gs-accent)",
              boxShadow: "var(--gs-shadow-glow)",
            }
          : {}
      }
    >
      <h3 className="font-semibold" style={{ color: "var(--gs-text)" }}>
        {name}
      </h3>
      <p
        className="text-xl font-bold mt-1"
        style={{ color: "var(--gs-text)" }}
      >
        {price}
      </p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-1.5 text-xs"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            <span style={{ color: "var(--gs-accent)" }} className="mt-0.5">
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      {current ? (
        <div
          className="mt-4 rounded-lg py-1.5 text-center text-xs font-medium"
          style={{
            border: "1px solid var(--gs-border)",
            color: "var(--gs-text-faint)",
          }}
        >
          Current plan
        </div>
      ) : onUpgrade ? (
        <button
          onClick={onUpgrade}
          disabled={upgrading}
          className={`mt-4 w-full rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            highlighted ? "gs-btn-primary" : "gs-btn-secondary"
          }`}
        >
          {upgrading ? "Redirecting…" : "Upgrade"}
        </button>
      ) : null}
    </div>
  );
}

function CreditPackCard({
  name,
  price,
  savings,
  highlighted,
  onBuy,
  buying,
}: {
  name: string;
  price: string;
  savings: string;
  highlighted?: boolean;
  onBuy: () => void;
  buying: boolean;
}) {
  return (
    <div
      className="gs-card-static p-4 flex flex-col"
      style={
        highlighted
          ? {
              borderColor: "var(--gs-accent)",
              boxShadow: "var(--gs-shadow-glow)",
            }
          : {}
      }
    >
      <div className="flex-1">
        <h3 className="font-semibold" style={{ color: "var(--gs-text)" }}>
          {name}
        </h3>
        <p
          className="text-xl font-bold mt-1"
          style={{ color: "var(--gs-text)" }}
        >
          {price}
        </p>
        {savings && (
          <p
            className="mt-1 text-xs font-medium"
            style={{ color: "var(--gs-success-text)" }}
          >
            {savings}
          </p>
        )}
      </div>
      <button
        onClick={onBuy}
        disabled={buying}
        className={`mt-3 w-full rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
          highlighted ? "gs-btn-primary" : "gs-btn-secondary"
        }`}
      >
        {buying ? "Redirecting…" : "Buy now"}
      </button>
    </div>
  );
}
