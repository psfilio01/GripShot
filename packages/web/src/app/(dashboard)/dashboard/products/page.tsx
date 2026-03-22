"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

interface ProductData {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  brandId: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  useEffect(() => {
    loadProducts();
    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.brands) setBrands(d.brands);
      })
      .catch(() => {});
  }, []);

  function loadProducts() {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.products) setProducts(d.products);
      })
      .catch(() => {});
  }

  const brandMap = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  const filteredProducts =
    brandFilter === "all"
      ? products
      : products.filter((p) => p.brandId === brandFilter);

  const hasFilter = brandFilter !== "all";

  return (
    <div className="space-y-6 gs-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--gs-text)" }}
          >
            Products
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
            Manage your products and their reference images.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFilter && (
            <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
              {filteredProducts.length} of {products.length}
            </p>
          )}
          {brands.length > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? "gs-btn-secondary px-4 py-2 text-sm" : "gs-btn-primary px-4 py-2 text-sm"}
            >
              {showForm ? "Cancel" : "+ New product"}
            </button>
          )}
        </div>
      </div>

      {/* Brand filter */}
      {brands.length > 1 && products.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="gs-input px-3 py-1.5 text-sm"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => setBrandFilter("all")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition"
              style={{ color: "var(--gs-accent-text)" }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {brands.length === 0 && (
        <EmptyState
          icon="🏷️"
          title="Create a brand first"
          description="Before adding products, you need at least one brand. Create one on the Brands page."
          actionLabel="Create brand"
          actionHref="/dashboard/brands"
        />
      )}

      {showForm && brands.length > 0 && (
        <CreateProductForm
          brands={brands}
          onCreated={() => {
            setShowForm(false);
            loadProducts();
          }}
        />
      )}

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} brandName={brandMap[p.brandId]} />
          ))}
        </div>
      ) : (
        brands.length > 0 &&
        !showForm && (
          hasFilter ? (
            <EmptyState
              icon="🔍"
              title="No products match this brand"
              description="Try selecting a different brand or clear the filter."
            />
          ) : (
            <EmptyState
              icon="📦"
              title="No products yet"
              description="Add your first product to start generating images and listing copy. Upload reference photos and let AI do the rest."
              actionLabel="+ New product"
              onAction={() => setShowForm(true)}
            />
          )
        )
      )}
    </div>
  );
}

function CreateProductForm({
  brands,
  onCreated,
}: {
  brands: BrandOption[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, name, category, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create product");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="gs-card-static p-6 space-y-4">
      <h2
        className="text-base font-semibold"
        style={{ color: "var(--gs-text)" }}
      >
        New product
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Product name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm"
            placeholder="e.g. Pilates Mini Ball"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Brand *
          </label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
          Category
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="gs-input block w-full px-3 py-2 text-sm"
          placeholder="e.g. Pilates Accessories"
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--gs-text-secondary)" }}
        >
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="gs-input block w-full px-3 py-2 text-sm resize-none"
          placeholder="Brief product description for AI context..."
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="gs-btn-primary px-5 py-2 text-sm"
        >
          {busy ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}

function ProductCard({ product, brandName }: { product: ProductData; brandName?: string }) {
  return (
    <div className="gs-card group relative p-5 space-y-3">
      <Link href={`/dashboard/products/${product.id}`} className="absolute inset-0" />
      <div className="flex items-start justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--gs-text)" }}
        >
          {product.name}
        </h3>
        <StatusBadge status={product.status} />
      </div>
      {brandName && (
        <p className="text-xs font-medium" style={{ color: "var(--gs-accent-text)" }}>
          {brandName}
        </p>
      )}
      {product.category && (
        <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
          {product.category}
        </p>
      )}
      {product.description && (
        <p
          className="text-xs line-clamp-2"
          style={{ color: "var(--gs-text-muted)" }}
        >
          {product.description}
        </p>
      )}
      <div className="relative flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/dashboard/generate?productId=${encodeURIComponent(product.id)}&tab=images`}
          className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition"
          style={{
            background: "var(--gs-surface-inset)",
            color: "var(--gs-text-muted)",
            border: "1px solid var(--gs-border-subtle)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Generate images
        </Link>
        <Link
          href={`/dashboard/generate?productId=${encodeURIComponent(product.id)}`}
          className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition"
          style={{
            background: "var(--gs-surface-inset)",
            color: "var(--gs-text-muted)",
            border: "1px solid var(--gs-border-subtle)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Listing copy
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStyle = (s: string) => {
    switch (s) {
      case "active":
        return {
          background: "var(--gs-success-bg)",
          color: "var(--gs-success-text)",
        };
      case "archived":
        return {
          background: "var(--gs-surface-inset)",
          color: "var(--gs-text-faint)",
        };
      default:
        return {
          background: "var(--gs-surface-inset)",
          color: "var(--gs-text-muted)",
        };
    }
  };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={getStyle(status)}
    >
      {status}
    </span>
  );
}
