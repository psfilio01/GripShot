"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";

interface BrandRow {
  id: string;
  name: string;
  isPrivateLabel: boolean;
  productCategory: string;
  dna: string;
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [isPrivateLabel, setIsPrivateLabel] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function load() {
    const res = await fetch("/api/brands");
    if (res.ok) {
      const data = await res.json();
      setBrands(data.brands ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          productCategory: productCategory.trim(),
          isPrivateLabel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast("Brand created", "success");
        setName("");
        setProductCategory("");
        setIsPrivateLabel(true);
        await load();
        router.push(`/dashboard/brands/${data.brandId}`);
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Create failed", "error");
      }
    } catch {
      toast("Create failed", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Brands
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Manage your brands. Each brand carries its own DNA, audience, and tone
          that shape AI-generated images and copy.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="gs-card-static p-6 space-y-4"
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--gs-text-secondary)" }}
        >
          New brand
        </h2>
        <div>
          <label
            htmlFor="brand-new-name"
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Brand name *
          </label>
          <input
            id="brand-new-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AuréLéa"
            className="gs-input block w-full px-3 py-2 text-sm"
            maxLength={100}
            data-testid="brand-new-name"
          />
        </div>
        <div>
          <label
            htmlFor="brand-new-category"
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Product category (optional)
          </label>
          <input
            id="brand-new-category"
            type="text"
            value={productCategory}
            onChange={(e) => setProductCategory(e.target.value)}
            placeholder="e.g. Pilates & Yoga Accessories"
            className="gs-input block w-full px-3 py-2 text-sm"
            maxLength={200}
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivateLabel}
            onChange={(e) => setIsPrivateLabel(e.target.checked)}
            className="h-4 w-4 rounded"
            style={{ accentColor: "var(--gs-accent)" }}
          />
          <span
            className="text-sm"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Private label brand
          </span>
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="gs-btn-primary px-4 py-2 text-sm"
          data-testid="brand-create-submit"
        >
          {creating ? "Creating…" : "Create brand"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--gs-text-faint)" }}>
          Loading…
        </p>
      ) : brands.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No brands yet"
          description="Create your first brand above. You can add DNA, audience, and tone details after creation."
        />
      ) : (
        <ul className="space-y-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/brands/${encodeURIComponent(b.id)}`}
                className="gs-card-static flex items-center justify-between p-4 transition hover:opacity-95"
                style={{ borderColor: "var(--gs-border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="font-semibold text-sm"
                      style={{ color: "var(--gs-text)" }}
                    >
                      {b.name}
                    </p>
                    {b.isPrivateLabel && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "var(--gs-accent-bg)",
                          color: "var(--gs-accent-text)",
                        }}
                      >
                        Private Label
                      </span>
                    )}
                  </div>
                  {b.productCategory ? (
                    <p
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: "var(--gs-text-muted)" }}
                    >
                      {b.productCategory}
                    </p>
                  ) : null}
                  {b.dna ? (
                    <p
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      {b.dna}
                    </p>
                  ) : (
                    <p
                      className="text-xs mt-0.5 italic"
                      style={{ color: "var(--gs-text-faint)" }}
                    >
                      No DNA set — click Manage to add details
                    </p>
                  )}
                </div>
                <span
                  className="text-xs font-medium shrink-0 ml-4"
                  style={{ color: "var(--gs-accent-text)" }}
                >
                  Manage →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
