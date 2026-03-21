"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/skeleton";

interface MeData {
  user: {
    uid: string;
    email: string;
    displayName: string | null;
  };
  workspace: {
    name: string;
    plan: string;
    quotaUsed: number;
    quotaLimit: number;
  };
}

interface BrandData {
  id: string;
  name: string;
  productCategory: string;
}

interface ProductData {
  id: string;
  name: string;
}

interface RecentGeneration {
  id: string;
  type: "listing-copy" | "aplus";
  productName: string;
  createdAt: { _seconds: number };
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [recentGens, setRecentGens] = useState<RecentGeneration[]>([]);
  const [imageJobCount, setImageJobCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setMe(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.brands) setBrands(data.brands);
      })
      .catch(() => {});

    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.products) setProducts(data.products);
      })
      .catch(() => {});

    fetch("/api/generations?limit=5")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.generations) setRecentGens(data.generations);
      })
      .catch(() => {});

    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.jobs) setImageJobCount(data.jobs.length);
      })
      .catch(() => {});
  }, []);

  if (!loaded) return <DashboardSkeleton />;

  const greeting = me?.user.displayName
    ? `Welcome back, ${me.user.displayName.split(" ")[0]}`
    : "Welcome to Grip Shot";

  const remaining = me
    ? Math.max(0, me.workspace.quotaLimit - me.workspace.quotaUsed)
    : 0;
  const usagePercent =
    me && me.workspace.quotaLimit > 0
      ? Math.round((me.workspace.quotaUsed / me.workspace.quotaLimit) * 100)
      : 0;

  return (
    <div className="space-y-6 gs-fade-in">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          {greeting}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Your Amazon product image command center.
        </p>
      </div>

      {/* Low-credit warning */}
      {me && usagePercent >= 90 && (
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{
            background: "var(--gs-warning-bg)",
            border: "1px solid var(--gs-warning-text)",
            borderColor: "color-mix(in srgb, var(--gs-warning-text) 30%, transparent)",
          }}
        >
          <div className="text-sm" style={{ color: "var(--gs-warning-text)" }}>
            You&apos;re running low on credits ({remaining} remaining).
          </div>
          <Link
            href="/dashboard/settings"
            className="text-sm font-semibold transition"
            style={{ color: "var(--gs-warning-text)" }}
          >
            {me.workspace.plan === "free" ? "Upgrade plan" : "View usage"}
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Plan"
          value={
            me?.workspace.plan
              ? me.workspace.plan.charAt(0).toUpperCase() +
                me.workspace.plan.slice(1)
              : "—"
          }
          description={me ? `${me.workspace.quotaLimit} credits/month` : ""}
        />
        <StatCard
          title="Products"
          value={String(products.length)}
          description="Products onboarded"
        />
        <StatCard
          title="Brands"
          value={String(brands.length)}
          description="Brands configured"
        />
        <StatCard
          title="Credits remaining"
          value={me ? String(remaining) : "—"}
          description={
            me
              ? `${me.workspace.quotaUsed} / ${me.workspace.quotaLimit} used`
              : "Monthly quota"
          }
          bar={me ? { percent: usagePercent } : undefined}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction
          href="/dashboard/generate"
          title="Generate"
          description="Create images, listing copy, or A+ content"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          }
        />
        <QuickAction
          href="/dashboard/products"
          title="Products"
          description="Manage products and reference images"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          }
        />
        <QuickAction
          href="/dashboard/results"
          title="Results"
          description="Browse and review generated content"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          }
        />
      </div>

      {/* Recent activity */}
      {(recentGens.length > 0 || imageJobCount > 0) && (
        <div className="gs-card-static p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--gs-text)" }}
            >
              Recent activity
            </h2>
            <Link
              href="/dashboard/results"
              className="text-sm font-medium transition"
              style={{ color: "var(--gs-accent-text)" }}
            >
              View all
            </Link>
          </div>

          {imageJobCount > 0 && (
            <Link
              href="/dashboard/results"
              className="flex items-center gap-3 rounded-lg px-4 py-3 mb-2 transition-colors"
              style={{
                border: "1px solid var(--gs-border-subtle)",
                background: "var(--gs-surface-inset)",
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: "var(--gs-accent-subtle)",
                  color: "var(--gs-accent)",
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--gs-text)" }}
                >
                  {imageJobCount} image generation{imageJobCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
                  View in results
                </p>
              </div>
            </Link>
          )}

          {recentGens.map((gen) => (
            <Link
              key={gen.id}
              href="/dashboard/generate"
              className="flex items-center gap-3 rounded-lg px-4 py-3 mb-2 last:mb-0 transition-colors"
              style={{
                border: "1px solid var(--gs-border-subtle)",
                background: "var(--gs-surface-inset)",
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background:
                    gen.type === "aplus"
                      ? "color-mix(in srgb, var(--gs-accent) 15%, transparent)"
                      : "var(--gs-accent-subtle)",
                  color: "var(--gs-accent)",
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--gs-text)" }}
                >
                  {gen.productName} — {gen.type === "aplus" ? "A+ content" : "Listing copy"}
                </p>
                <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
                  {gen.createdAt?._seconds
                    ? new Date(gen.createdAt._seconds * 1000).toLocaleDateString()
                    : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Brand section */}
      {brands.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            border: "2px dashed var(--gs-border)",
            background: "var(--gs-surface-inset)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--gs-accent-subtle)" }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: "var(--gs-accent)" }}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--gs-text)" }}
          >
            Let&apos;s get started
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--gs-text-muted)" }}
          >
            Set up your brand to start generating Amazon-ready images and copy.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="gs-btn-primary mt-5 inline-block px-6 py-2.5 text-sm"
          >
            Set up your brand
          </Link>
        </div>
      ) : (
        <div className="gs-card-static p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--gs-text)" }}
            >
              Your brands
            </h2>
            <Link
              href="/dashboard/onboarding"
              className="text-sm font-medium transition"
              style={{ color: "var(--gs-accent-text)" }}
            >
              + Add brand
            </Link>
          </div>
          <div className="space-y-2">
            {brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors"
                style={{
                  border: "1px solid var(--gs-border-subtle)",
                  background: "var(--gs-surface-inset)",
                }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--gs-text)" }}
                  >
                    {b.name}
                  </p>
                  {b.productCategory && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      {b.productCategory}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--gs-success-bg)",
                    color: "var(--gs-success-text)",
                  }}
                >
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  bar,
}: {
  title: string;
  value: string;
  description: string;
  bar?: { percent: number };
}) {
  return (
    <div className="gs-card-static p-5">
      <p
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--gs-text-faint)" }}
      >
        {title}
      </p>
      <p
        className="mt-2 text-3xl font-bold"
        style={{ color: "var(--gs-text)" }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--gs-text-faint)" }}>
        {description}
      </p>
      {bar && (
        <div
          className="mt-3 h-1.5 w-full rounded-full"
          style={{ background: "var(--gs-surface-inset)" }}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, bar.percent)}%`,
              backgroundColor:
                bar.percent >= 90
                  ? "var(--gs-error-text)"
                  : bar.percent >= 70
                    ? "var(--gs-warning-text)"
                    : "var(--gs-accent)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="gs-card group flex items-start gap-4 p-5">
      <div
        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
        style={{
          background: "var(--gs-accent-subtle)",
          color: "var(--gs-accent)",
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          {title}
        </h3>
        <p
          className="mt-0.5 text-xs"
          style={{ color: "var(--gs-text-muted)" }}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}
