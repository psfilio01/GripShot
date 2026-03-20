"use client";

import { useState } from "react";
import { ListingCopyTab } from "./listing-copy-tab";
import { ImageGenerationTab } from "./image-generation-tab";
import { AplusContentTab } from "./aplus-content-tab";

const TABS = ["Listing copy", "A+ content", "Image generation"] as const;
type Tab = (typeof TABS)[number];

export default function GeneratePage() {
  const [tab, setTab] = useState<Tab>("Listing copy");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
          Generate
        </h1>
        <p className="mt-1 text-sm text-sand-500">
          AI-powered content for your Amazon listings.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-sand-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-sand-800 shadow-sm"
                : "text-sand-500 hover:text-sand-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Listing copy" && <ListingCopyTab />}
      {tab === "A+ content" && <AplusContentTab />}
      {tab === "Image generation" && <ImageGenerationTab />}
    </div>
  );
}
