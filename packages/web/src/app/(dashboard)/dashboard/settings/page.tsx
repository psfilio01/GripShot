"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

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
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managing, setManaging] = useState(false);
  const billingStatus = searchParams.get("billing");

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
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-sand-800">Settings</h1>
        <p className="mt-1 text-sm text-sand-500">
          Manage your account, plan, and usage.
        </p>
      </div>

      {billingStatus === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Your subscription has been activated! It may take a moment to reflect.
        </div>
      )}
      {billingStatus === "cancelled" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout was cancelled. You can upgrade anytime.
        </div>
      )}

      {/* Account */}
      <section className="rounded-xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-medium text-sand-800">Account</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-sand-500">Email</span>
            <span className="text-sm font-medium text-sand-700">
              {user?.email ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-sand-500">Display name</span>
            <span className="text-sm font-medium text-sand-700">
              {user?.displayName ?? "—"}
            </span>
          </div>
        </div>
      </section>

      {/* Plan & Usage */}
      <section className="rounded-xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-medium text-sand-800">
          Plan &amp; Usage
        </h2>

        {loading ? (
          <div className="mt-4 text-sm text-sand-400">Loading…</div>
        ) : quota ? (
          <div className="mt-4 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl font-semibold text-sand-800">
                  {PLAN_LABELS[quota.plan] ?? quota.plan}
                </span>
                <span className="ml-2 text-sm text-sand-400">
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
                  className="rounded-lg bg-peach-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-peach-600 disabled:opacity-50"
                >
                  {upgrading ? "Redirecting…" : "Upgrade to Starter"}
                </button>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  disabled={managing}
                  className="rounded-lg border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
                >
                  {managing ? "Redirecting…" : "Manage Subscription"}
                </button>
              )}
            </div>

            {/* Usage bar */}
            <div>
              <div className="flex justify-between text-xs text-sand-500 mb-1.5">
                <span>Credits used this period</span>
                <span>
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-sand-100">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${usagePercent}%`,
                    backgroundColor:
                      usagePercent >= 90
                        ? "#ef4444"
                        : usagePercent >= 70
                          ? "#f59e0b"
                          : "#d4956a",
                  }}
                />
              </div>
              {usagePercent >= 90 && (
                <p className="mt-2 text-xs text-red-600">
                  You&apos;re running low on credits.{" "}
                  {quota.plan === "free"
                    ? "Upgrade to get more."
                    : "Credits reset next billing cycle."}
                </p>
              )}
            </div>

            {/* Credit breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <CreditCard label="Used" value={quota.used} />
              <CreditCard label="Remaining" value={quota.remaining} />
              <CreditCard label="Limit" value={quota.limit} />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-sand-400">
            Could not load plan information.
          </p>
        )}
      </section>

      {/* Plan Comparison */}
      {quota?.plan === "free" && (
        <section className="rounded-xl border border-sand-200 bg-white p-6">
          <h2 className="text-lg font-medium text-sand-800">
            Compare Plans
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <PlanCard
              name="Free"
              price="€0/mo"
              features={[
                "50 credits/month",
                "1 brand",
                "3 products",
              ]}
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
    <div className="rounded-lg border border-sand-100 bg-sand-50 p-3 text-center">
      <p className="text-xs text-sand-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-sand-700">{value}</p>
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
      className={`rounded-lg border p-4 ${
        highlighted
          ? "border-peach-300 bg-peach-50/50"
          : "border-sand-200 bg-white"
      }`}
    >
      <h3 className="font-medium text-sand-800">{name}</h3>
      <p className="text-xl font-semibold text-sand-700 mt-1">{price}</p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-sand-600">
            <span className="text-peach-500 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {current ? (
        <div className="mt-4 rounded-lg border border-sand-200 py-1.5 text-center text-xs font-medium text-sand-500">
          Current plan
        </div>
      ) : onUpgrade ? (
        <button
          onClick={onUpgrade}
          disabled={upgrading}
          className={`mt-4 w-full rounded-lg py-1.5 text-xs font-medium text-white transition disabled:opacity-50 ${
            highlighted
              ? "bg-peach-500 hover:bg-peach-600"
              : "bg-sand-600 hover:bg-sand-700"
          }`}
        >
          {upgrading ? "Redirecting…" : "Upgrade"}
        </button>
      ) : null}
    </div>
  );
}
