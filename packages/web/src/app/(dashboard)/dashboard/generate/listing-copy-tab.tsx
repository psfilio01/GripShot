"use client";

import { useEffect, useState, useCallback, type FormEvent, type ReactNode } from "react";

interface ProductOption {
  id: string;
  name: string;
}

interface ListingCopyResult {
  title: string;
  bulletPoints: string[];
  description: string;
}

interface HistoryItem {
  id: string;
  productName: string;
  result: ListingCopyResult;
  createdAt: { _seconds: number };
}

export function ListingCopyTab() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [keywords, setKeywords] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListingCopyResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(() => {
    fetch("/api/generations?type=listing-copy&limit=10")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.generations) setHistory(d.generations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.products) {
          setProducts(d.products);
          if (d.products.length > 0) setSelectedProduct(d.products[0].id);
        }
      })
      .catch(() => {});

    loadHistory();
  }, [loadHistory]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);

    try {
      const res = await fetch("/api/generate/listing-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct,
          keywords,
          additionalNotes: notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            `Quota exceeded (${data.used}/${data.limit} credits used). Upgrade your plan for more credits.`,
          );
        }
        throw new Error(data.error ?? "Generation failed");
      }
      setResult(data.result);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return (
      <div
        className="rounded-xl p-12 text-center"
        style={{
          border: "2px dashed var(--gs-border)",
          background: "var(--gs-surface-inset)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Add a product first to start generating listing copy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="gs-card-static p-6 space-y-4">
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Target keywords
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm"
            placeholder="e.g. pilates ball, exercise ball, core training"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Additional notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm resize-none"
            placeholder="e.g. emphasize premium materials"
          />
        </div>

        {error && (
          <p
            className="rounded-lg p-3 text-sm"
            style={{
              background: "var(--gs-error-bg)",
              color: "var(--gs-error-text)",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !selectedProduct}
          className="gs-btn-primary px-5 py-2.5 text-sm"
        >
          {busy ? "Generating…" : "Generate listing copy"}
        </button>
      </form>

      {result && <ListingCopyResult result={result} />}

      {history.length > 0 && (
        <div className="space-y-3">
          <h3
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Recent generations
          </h3>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setResult(item.result)}
                className="gs-card w-full text-left p-4"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--gs-text)" }}
                  >
                    {item.productName}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--gs-text-faint)" }}
                  >
                    {item.createdAt?._seconds
                      ? new Date(
                          item.createdAt._seconds * 1000,
                        ).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p
                  className="mt-1 text-xs line-clamp-1"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {item.result.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium transition"
      style={{
        background: copied ? "var(--gs-success-bg)" : "var(--gs-surface-inset)",
        color: copied ? "var(--gs-success-text)" : "var(--gs-text-muted)",
      }}
      title="Copy to clipboard"
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

function ListingCopyResult({ result }: { result: ListingCopyResult }) {
  const allText = `${result.title}\n\n${result.bulletPoints.map((b) => `• ${b}`).join("\n")}\n\n${result.description}`;
  const bulletsText = result.bulletPoints.map((b) => `• ${b}`).join("\n");

  return (
    <div className="space-y-4">
      <div className="gs-card-static p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Title
            </h3>
            <CopyButton text={result.title} />
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--gs-text)" }}
          >
            {result.title}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <h3
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Bullet points
            </h3>
            <CopyButton text={bulletsText} />
          </div>
          <ul className="space-y-1">
            {result.bulletPoints.map((bp, i) => (
              <li
                key={i}
                className="text-sm flex gap-2"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                <span
                  className="shrink-0"
                  style={{ color: "var(--gs-accent)" }}
                >
                  •
                </span>
                {bp}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <h3
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Description
            </h3>
            <CopyButton text={result.description} />
          </div>
          <p
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {result.description}
          </p>
        </div>
      </div>

      <CopyButton text={allText} label="Copy all to clipboard" />
    </div>
  );
}
