"use client";

import { useEffect, useState } from "react";

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

export default function DashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
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

      <div className="rounded-xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-medium text-sand-800">Getting started</h2>
        <ol className="mt-3 space-y-2 text-sm text-sand-600 leading-relaxed list-decimal list-inside">
          <li>
            <span className="font-medium text-sand-700">Onboard your brand</span>
            {" "}— tell us about your brand DNA, target audience, and tone
          </li>
          <li>
            <span className="font-medium text-sand-700">Add products</span>
            {" "}— upload reference images, categorize assets, set up variants
          </li>
          <li>
            <span className="font-medium text-sand-700">Generate</span>
            {" "}— create Amazon-ready listing images, lifestyle shots, and A+ content
          </li>
          <li>
            <span className="font-medium text-sand-700">Review & export</span>
            {" "}— favorite the best, reject the rest, download production files
          </li>
        </ol>
      </div>
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
