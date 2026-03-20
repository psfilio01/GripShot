"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
            Products
          </h1>
          <p className="mt-1 text-sm text-sand-500">
            Manage your products and their reference images.
          </p>
        </div>
        {brands.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sand-700 transition"
          >
            {showForm ? "Cancel" : "+ New product"}
          </button>
        )}
      </div>

      {brands.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-sand-300 bg-white p-8 text-center">
          <p className="text-sm text-sand-500">
            Set up a brand first before adding products.
          </p>
        </div>
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

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        brands.length > 0 &&
        !showForm && (
          <div className="rounded-xl border-2 border-dashed border-sand-300 bg-white p-8 text-center">
            <p className="text-sm text-sand-500">
              No products yet. Click &quot;+ New product&quot; to add your
              first.
            </p>
          </div>
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
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-sand-200 bg-white p-6 space-y-4"
    >
      <h2 className="text-lg font-medium text-sand-800">New product</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Product name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
            placeholder="e.g. Pilates Mini Ball"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sand-700">
            Brand *
          </label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
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
        <label className="block text-sm font-medium text-sand-700">
          Category
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
          placeholder="e.g. Pilates Accessories"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
          placeholder="Brief product description for AI context..."
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-peach-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-peach-400 disabled:opacity-50 transition"
        >
          {busy ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}

function ProductCard({ product }: { product: ProductData }) {
  const statusColors: Record<string, string> = {
    draft: "bg-sand-100 text-sand-600",
    active: "bg-olive-100 text-olive-600",
    archived: "bg-sand-200 text-sand-500",
  };

  return (
    <Link
      href={`/dashboard/products/${product.id}`}
      className="block rounded-xl border border-sand-200 bg-white p-5 space-y-3 hover:border-sand-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-sand-800">{product.name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            statusColors[product.status] ?? statusColors.draft
          }`}
        >
          {product.status}
        </span>
      </div>
      {product.category && (
        <p className="text-xs text-sand-400">{product.category}</p>
      )}
      {product.description && (
        <p className="text-xs text-sand-500 line-clamp-2">
          {product.description}
        </p>
      )}
    </Link>
  );
}
