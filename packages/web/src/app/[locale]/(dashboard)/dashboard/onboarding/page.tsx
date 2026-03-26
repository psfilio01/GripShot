"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

const STEPS = [
  "Brand basics",
  "Brand DNA",
  "Audience & tone",
  "Done",
] as const;

interface FormState {
  name: string;
  isPrivateLabel: boolean;
  dna: string;
  targetAudience: string;
  productCategory: string;
  tone: string;
}

const INITIAL: FormState = {
  name: "",
  isPrivateLabel: true,
  dna: "",
  targetAudience: "",
  productCategory: "",
  tone: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBrandName, setCreatedBrandName] = useState<string | null>(
    null,
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create brand");
      }

      setCreatedBrandName(form.name);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  void router;
  const canProceed = step === 0 ? form.name.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-lg space-y-8 gs-fade-in">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gs-text)" }}
        >
          Set up your brand
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--gs-text-muted)" }}>
          Tell us about your brand so we can tailor your images and copy.
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className="h-1 rounded-full transition-all"
              style={{
                background:
                  i <= step ? "var(--gs-accent)" : "var(--gs-border)",
              }}
            />
            <p
              className="mt-1.5 text-xs font-medium"
              style={{
                color:
                  i <= step
                    ? "var(--gs-text-secondary)"
                    : "var(--gs-text-faint)",
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 0 && (
          <div className="gs-card-static p-6 space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Brand name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm"
                placeholder="e.g. AuréLéa"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPrivateLabel}
                  onChange={(e) => update("isPrivateLabel", e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--gs-accent)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--gs-text-secondary)" }}
                >
                  This is a private label brand
                </span>
              </label>
              <p
                className="mt-1 ml-7 text-xs"
                style={{ color: "var(--gs-text-faint)" }}
              >
                Private label brands sell under their own brand name on Amazon.
              </p>
            </div>

            <div>
              <label
                htmlFor="productCategory"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Product category
              </label>
              <input
                id="productCategory"
                type="text"
                value={form.productCategory}
                onChange={(e) => update("productCategory", e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm"
                placeholder="e.g. Pilates & Yoga Accessories"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="gs-card-static p-6 space-y-4">
            <div>
              <label
                htmlFor="dna"
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Brand DNA
              </label>
              <p
                className="text-xs mb-2"
                style={{ color: "var(--gs-text-faint)" }}
              >
                Describe your brand&apos;s visual identity, mood, and values.
                This shapes how AI generates your images and copy.
              </p>
              <textarea
                id="dna"
                rows={6}
                value={form.dna}
                onChange={(e) => update("dna", e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm resize-none"
                placeholder="e.g. Quiet, refined elegance in movement. Calm, minimal, feminine, and premium. Inspired by Pilates studios, natural light, and Mediterranean softness..."
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="gs-card-static p-6 space-y-4">
            <div>
              <label
                htmlFor="targetAudience"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Target audience
              </label>
              <textarea
                id="targetAudience"
                rows={3}
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm resize-none"
                placeholder="e.g. Women 25-40, health-conscious, design-focused, willing to pay for quality"
              />
            </div>

            <div>
              <label
                htmlFor="tone"
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--gs-text-secondary)" }}
              >
                Tone & conversion priorities
              </label>
              <textarea
                id="tone"
                rows={3}
                value={form.tone}
                onChange={(e) => update("tone", e.target.value)}
                className="gs-input block w-full px-3 py-2 text-sm resize-none"
                placeholder="e.g. Elegant but approachable. Prioritize trust, quality perception, and lifestyle aspiration."
              />
            </div>
          </div>
        )}

        {step === 3 && createdBrandName && (
          <div
            className="gs-card-static p-8 text-center space-y-6"
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: "var(--gs-success-bg)",
              }}
            >
              <CheckIcon style={{ color: "var(--gs-success-text)" }} />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--gs-text)" }}
              >
                {createdBrandName} is ready!
              </h2>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--gs-text-muted)" }}
              >
                Your brand has been created. Here&apos;s what to do next:
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard/products"
                className="gs-btn-primary px-5 py-3 text-sm text-center"
              >
                Add your first product
              </Link>
              <Link
                href="/dashboard"
                className="gs-btn-secondary px-5 py-3 text-sm text-center"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        )}

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

        {step < 3 && (
          <div className="flex justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              className="gs-btn-secondary px-4 py-2 text-sm disabled:opacity-30"
            >
              Back
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canProceed}
                className="gs-btn-primary px-5 py-2 text-sm"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !canProceed}
                className="gs-btn-primary px-5 py-2 text-sm"
              >
                {busy ? "Creating…" : "Create brand"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function CheckIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      className="h-6 w-6"
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}
