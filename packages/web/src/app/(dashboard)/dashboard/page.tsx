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

export default function DashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [brands, setBrands] = useState<BrandData[]>([]);

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
  }, []);

  const greeting = me?.user.displayName
    ? `Welcome, ${me.user.displayName.split(" ")[0]}`
    : "Welcome to Grip Shot";

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Products"
          value="0"
          description="Products onboarded"
        />
        <StatCard
          title="Images generated"
          value="0"
          description="Total images created"
        />
        <StatCard
          title="Credits remaining"
          value={
            me
              ? `${me.workspace.quotaLimit - me.workspace.quotaUsed}`
              : "—"
          }
          description={
            me
              ? `${me.workspace.quotaUsed} / ${me.workspace.quotaLimit} used · ${me.workspace.plan} plan`
              : "Monthly quota"
          }
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
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white p-5">
      <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-sand-800">{value}</p>
      <p className="mt-1 text-xs text-sand-400">{description}</p>
    </div>
  );
}
