"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListingCopyTab } from "./listing-copy-tab";
import { ImageGenerationTab } from "./image-generation-tab";
import { AplusContentTab } from "./aplus-content-tab";

const TABS = ["Listing copy", "A+ content", "Image generation"] as const;
type Tab = (typeof TABS)[number];

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const prefillProductId = searchParams.get("productId") ?? undefined;
  const prefillTab = searchParams.get("tab");

  const initialTab: Tab =
    prefillTab === "images"
      ? "Image generation"
      : prefillTab === "aplus"
        ? "A+ content"
        : "Listing copy";

  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Generate
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          AI-powered content for your Amazon listings.
        </p>
      </div>

      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--gs-surface-inset)" }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all"
            style={
              tab === t
                ? {
                    background: "var(--gs-surface)",
                    color: "var(--gs-text)",
                    boxShadow: "var(--gs-shadow-sm)",
                  }
                : {
                    color: "var(--gs-text-muted)",
                  }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Listing copy" && (
        <ListingCopyTab prefillProductId={prefillProductId} />
      )}
      {tab === "A+ content" && (
        <AplusContentTab prefillProductId={prefillProductId} />
      )}
      {tab === "Image generation" && (
        <ImageGenerationTab prefillProductId={prefillProductId} />
      )}
    </div>
  );
}
