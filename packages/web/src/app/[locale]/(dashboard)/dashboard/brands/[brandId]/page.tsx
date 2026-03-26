"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface BrandData {
  id: string;
  name: string;
  isPrivateLabel: boolean;
  dna: string;
  targetAudience: string;
  productCategory: string;
  tone: string;
}

export default function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const router = useRouter();
  const [brand, setBrand] = useState<BrandData | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();

  const [editName, setEditName] = useState("");
  const [editIsPrivateLabel, setEditIsPrivateLabel] = useState(true);
  const [editCategory, setEditCategory] = useState("");
  const [editDna, setEditDna] = useState("");
  const [editAudience, setEditAudience] = useState("");
  const [editTone, setEditTone] = useState("");

  const loadBrand = useCallback(async () => {
    const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}`);
    if (!res.ok) {
      setBrand(null);
      return;
    }
    const data = await res.json();
    const b = data.brand as BrandData;
    setBrand(b);
    setEditName(b.name);
    setEditIsPrivateLabel(b.isPrivateLabel);
    setEditCategory(b.productCategory ?? "");
    setEditDna(b.dna ?? "");
    setEditAudience(b.targetAudience ?? "");
    setEditTone(b.tone ?? "");
  }, [brandId]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          isPrivateLabel: editIsPrivateLabel,
          productCategory: editCategory.trim(),
          dna: editDna.trim(),
          targetAudience: editAudience.trim(),
          tone: editTone.trim(),
        }),
      });
      if (res.ok) {
        toast("Brand saved", "success");
        await loadBrand();
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error ?? "Save failed", "error");
      }
    } catch {
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast("Brand deleted", "success");
      router.push("/dashboard/brands");
    } else {
      toast("Delete failed", "error");
    }
    setConfirmDelete(false);
  }

  if (brand === undefined) {
    return (
      <div
        className="py-16 text-center text-sm"
        style={{ color: "var(--gs-text-faint)" }}
      >
        Loading…
      </div>
    );
  }

  if (brand === null) {
    return (
      <div
        className="py-16 text-center text-sm"
        style={{ color: "var(--gs-text-faint)" }}
      >
        Brand not found.{" "}
        <Link href="/dashboard/brands" className="underline">
          Back to brands
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8 gs-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard/brands"
          style={{ color: "var(--gs-text-faint)" }}
        >
          Brands
        </Link>
        <span style={{ color: "var(--gs-text-faint)" }}>/</span>
        <span style={{ color: "var(--gs-text-secondary)" }}>
          {brand.name}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Name & basics */}
        <div className="gs-card-static p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4 flex-1 min-w-[200px]">
              <div>
                <label
                  htmlFor="brand-detail-name"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--gs-text-secondary)" }}
                >
                  Brand name *
                </label>
                <input
                  id="brand-detail-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="gs-input block w-full px-3 py-2 text-sm"
                  maxLength={100}
                />
              </div>
              <div>
                <label
                  htmlFor="brand-detail-category"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--gs-text-secondary)" }}
                >
                  Product category
                </label>
                <input
                  id="brand-detail-category"
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="gs-input block w-full px-3 py-2 text-sm"
                  placeholder="e.g. Pilates & Yoga Accessories"
                  maxLength={200}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPrivateLabel}
                  onChange={(e) => setEditIsPrivateLabel(e.target.checked)}
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
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="gs-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: "var(--gs-error-bg)",
                  color: "var(--gs-error-text)",
                }}
              >
                Delete brand
              </button>
            </div>
          </div>
        </div>

        {/* Brand DNA */}
        <div className="gs-card-static p-6 space-y-4">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Brand DNA
          </h2>
          <p className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
            Describe your brand&apos;s visual identity, mood, and values. This
            shapes how AI generates images and copy.
          </p>
          <textarea
            id="brand-detail-dna"
            rows={5}
            value={editDna}
            onChange={(e) => setEditDna(e.target.value)}
            className="gs-input block w-full px-3 py-2 text-sm resize-none"
            placeholder="e.g. Quiet, refined elegance in movement. Calm, minimal, feminine, and premium…"
            maxLength={2000}
          />
        </div>

        {/* Audience & Tone */}
        <div className="gs-card-static p-6 space-y-4">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--gs-text-secondary)" }}
          >
            Audience & tone
          </h2>
          <div>
            <label
              htmlFor="brand-detail-audience"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Target audience
            </label>
            <textarea
              id="brand-detail-audience"
              rows={3}
              value={editAudience}
              onChange={(e) => setEditAudience(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm resize-none"
              placeholder="e.g. Women 25-40, health-conscious, design-focused, willing to pay for quality"
              maxLength={500}
            />
          </div>
          <div>
            <label
              htmlFor="brand-detail-tone"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--gs-text-secondary)" }}
            >
              Tone & conversion priorities
            </label>
            <textarea
              id="brand-detail-tone"
              rows={3}
              value={editTone}
              onChange={(e) => setEditTone(e.target.value)}
              className="gs-input block w-full px-3 py-2 text-sm resize-none"
              placeholder="e.g. Elegant but approachable. Prioritize trust, quality perception, and lifestyle aspiration."
              maxLength={500}
            />
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this brand?"
        message="This permanently removes the brand and all its settings. Products linked to this brand will no longer have a brand association."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
