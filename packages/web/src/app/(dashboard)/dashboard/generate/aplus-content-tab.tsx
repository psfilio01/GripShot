"use client";

import { useEffect, useState, type FormEvent } from "react";

interface ProductOption {
  id: string;
  name: string;
}

const MODULE_OPTIONS = [
  { id: "hero-banner", label: "Hero Banner" },
  { id: "feature-highlights", label: "Feature Highlights" },
  { id: "comparison-chart", label: "Comparison Chart" },
  { id: "brand-story", label: "Brand Story" },
  { id: "tech-specs", label: "Technical Specifications" },
];

export function AplusContentTab() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedModule, setSelectedModule] = useState("hero-banner");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    moduleName: string;
    amazonModuleType: string;
    content: Record<string, unknown>;
  } | null>(null);

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
      const res = await fetch("/api/generate/aplus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct,
          moduleId: selectedModule,
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

      setResult({
        moduleName: data.moduleName,
        amazonModuleType: data.amazonModuleType,
        content: data.content,
      });
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
          Add a product first to start generating A+ content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="gs-card-static p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              A+ Module Type
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
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
            placeholder="e.g. focus on eco-friendly materials, target yoga beginners"
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
          {busy ? "Generating…" : "Generate A+ content"}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--gs-text)" }}
            >
              {result.moduleName}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: "var(--gs-success-bg)",
                color: "var(--gs-success-text)",
              }}
            >
              {result.amazonModuleType}
            </span>
          </div>

          <div className="gs-card-static p-6">
            <AplusResultRenderer content={result.content} />
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(
                JSON.stringify(result.content, null, 2),
              );
            }}
            className="gs-btn-secondary px-4 py-2 text-sm"
          >
            Copy JSON to clipboard
          </button>
        </div>
      )}
    </div>
  );
}

function AplusResultRenderer({
  content,
}: {
  content: Record<string, unknown>;
}) {
  if ("headline" in content && "body" in content) {
    return (
      <div className="space-y-4">
        {content.headline ? (
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Headline
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "var(--gs-text)" }}
            >
              {String(content.headline)}
            </p>
          </div>
        ) : null}
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--gs-text-faint)" }}
          >
            Body
          </p>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            {String(content.body)}
          </p>
        </div>
        {content.imageDirection ? (
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Image Direction
            </p>
            <p
              className="mt-1 text-sm italic"
              style={{ color: "var(--gs-text-muted)" }}
            >
              {String(content.imageDirection)}
            </p>
          </div>
        ) : null}
        {Array.isArray(content.values) && (
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--gs-text-faint)" }}
            >
              Values
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {(content.values as string[]).map((v, i) => (
                <span
                  key={i}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "var(--gs-accent-subtle)",
                    color: "var(--gs-accent-text)",
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if ("features" in content && Array.isArray(content.features)) {
    return (
      <div className="space-y-4">
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Features
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(content.features as { title: string; body: string }[]).map(
            (f, i) => (
              <div
                key={i}
                className="rounded-lg p-4"
                style={{
                  background: "var(--gs-surface-inset)",
                  border: "1px solid var(--gs-border-subtle)",
                }}
              >
                <h4
                  className="text-sm font-semibold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {f.title}
                </h4>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {f.body}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  if (
    "columns" in content &&
    "rows" in content &&
    Array.isArray(content.columns) &&
    Array.isArray(content.rows)
  ) {
    const columns = content.columns as string[];
    const rows = content.rows as {
      attribute: string;
      values: string[];
    }[];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--gs-border)" }}>
              <th
                className="pb-2 pr-4 text-left text-xs font-medium"
                style={{ color: "var(--gs-text-faint)" }}
              >
                Attribute
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="pb-2 px-4 text-left text-xs font-medium"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid var(--gs-border-subtle)" }}
              >
                <td
                  className="py-2 pr-4 font-medium"
                  style={{ color: "var(--gs-text)" }}
                >
                  {row.attribute}
                </td>
                {row.values.map((val, j) => (
                  <td
                    key={j}
                    className="py-2 px-4"
                    style={{ color: "var(--gs-text-secondary)" }}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if ("specs" in content && Array.isArray(content.specs)) {
    return (
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wider mb-3"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Specifications
        </p>
        <div>
          {(content.specs as { label: string; value: string }[]).map(
            (spec, i) => (
              <div
                key={i}
                className="flex justify-between py-2"
                style={{ borderBottom: "1px solid var(--gs-border-subtle)" }}
              >
                <span
                  className="text-sm"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {spec.label}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--gs-text)" }}
                >
                  {spec.value}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <pre
      className="text-xs overflow-x-auto whitespace-pre-wrap"
      style={{ color: "var(--gs-text-muted)" }}
    >
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}
