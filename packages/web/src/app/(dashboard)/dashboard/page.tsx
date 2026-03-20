"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function DashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});

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
  }, []);

  const greeting = me?.user.displayName
    ? `Welcome, ${me.user.displayName.split(" ")[0]}`
    : "Welcome to Grip Shot";

  const remaining = me
    ? Math.max(0, me.workspace.quotaLimit - me.workspace.quotaUsed)
    : 0;
  const usagePercent =
    me && me.workspace.quotaLimit > 0
      ? Math.round((me.workspace.quotaUsed / me.workspace.quotaLimit) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-sand-500">
          Your Amazon product image command center.
        </p>
      </div>

      {/* Low-credit warning */}
      {me && usagePercent >= 90 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
          <div className="text-sm text-amber-800">
            You&apos;re running low on credits ({remaining} remaining).
          </div>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-amber-700 hover:text-amber-900 transition"
          >
            {me.workspace.plan === "free" ? "Upgrade plan" : "View usage"}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Plan"
          value={me?.workspace.plan?.charAt(0).toUpperCase() + (me?.workspace.plan?.slice(1) ?? "") || "—"}
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
          description="Create images or listing copy"
          color="peach"
        />
        <QuickAction
          href="/dashboard/products"
          title="Products"
          description="Manage products and reference images"
          color="olive"
        />
        <QuickAction
          href="/dashboard/results"
          title="Results"
          description="Browse and review generated content"
          color="sand"
        />
      </div>

      {brands.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-peach-300 bg-peach-50/50 p-6 text-center">
          <h2 className="text-lg font-medium text-sand-800">
            Let&apos;s get started
          </h2>
          <p className="mt-2 text-sm text-sand-500">
            Set up your brand to start generating Amazon-ready images and copy.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="mt-4 inline-block rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-peach-400 transition"
          >
            Set up your brand
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-sand-200 bg-white p-6">
          <h2 className="text-lg font-medium text-sand-800">Your brands</h2>
          <div className="mt-3 space-y-2">
            {brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-sand-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-sand-800">{b.name}</p>
                  {b.productCategory && (
                    <p className="text-xs text-sand-400">{b.productCategory}</p>
                  )}
                </div>
                <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-600">
                  Active
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/onboarding"
            className="mt-3 inline-block text-sm font-medium text-peach-500 hover:text-peach-600 transition"
          >
            + Add another brand
          </Link>
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
    <div className="rounded-xl border border-sand-200 bg-white p-5">
      <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-sand-800">{value}</p>
      <p className="mt-1 text-xs text-sand-400">{description}</p>
      {bar && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-sand-100">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, bar.percent)}%`,
              backgroundColor:
                bar.percent >= 90
                  ? "#ef4444"
                  : bar.percent >= 70
                    ? "#f59e0b"
                    : "#d4956a",
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
  color,
}: {
  href: string;
  title: string;
  description: string;
  color: "peach" | "olive" | "sand";
}) {
  const colors = {
    peach: "border-peach-200 hover:border-peach-300 hover:bg-peach-50/30",
    olive: "border-olive-200 hover:border-olive-300 hover:bg-olive-50/30",
    sand: "border-sand-200 hover:border-sand-300 hover:bg-sand-50/50",
  };

  return (
    <Link
      href={href}
      className={`block rounded-xl border bg-white p-5 transition ${colors[color]}`}
    >
      <h3 className="text-sm font-semibold text-sand-800">{title}</h3>
      <p className="mt-1 text-xs text-sand-400">{description}</p>
    </Link>
  );
}
