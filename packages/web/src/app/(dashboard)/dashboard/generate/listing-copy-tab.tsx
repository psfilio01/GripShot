"use client";

import { useEffect, useState, type FormEvent } from "react";

interface ProductOption {
  id: string;
  name: string;
}

interface ListingCopyResult {
  title: string;
  bulletPoints: string[];
  description: string;
}

export function ListingCopyTab() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [keywords, setKeywords] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListingCopyResult | null>(null);

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
  }, []);

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
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-sand-300 bg-white p-12 text-center">
        <p className="text-sm text-sand-500">
          Add a product first to start generating listing copy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerate}
        className="rounded-xl border border-sand-200 bg-white p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-sand-700">
            Target keywords
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
            placeholder="e.g. pilates ball, exercise ball, core training"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sand-700">
            Additional notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
            placeholder="e.g. emphasize premium materials"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !selectedProduct}
          className="rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-peach-400 disabled:opacity-50 transition"
        >
          {busy ? "Generating…" : "Generate listing copy"}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sand-200 bg-white p-6 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                Title
              </h3>
              <p className="mt-1 text-sm font-medium text-sand-800">
                {result.title}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                Bullet points
              </h3>
              <ul className="mt-1 space-y-1">
                {result.bulletPoints.map((bp, i) => (
                  <li key={i} className="text-sm text-sand-700 flex gap-2">
                    <span className="text-peach-400 shrink-0">•</span>
                    {bp}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                Description
              </h3>
              <p className="mt-1 text-sm text-sand-700 leading-relaxed whitespace-pre-line">
                {result.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const text = `${result.title}\n\n${result.bulletPoints.map((b) => `• ${b}`).join("\n")}\n\n${result.description}`;
              navigator.clipboard.writeText(text);
            }}
            className="rounded-lg border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-sand-600 shadow-sm hover:bg-sand-50 transition"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
