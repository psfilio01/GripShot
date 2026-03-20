"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const STEPS = ["Brand basics", "Brand DNA", "Audience & tone"] as const;

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

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canProceed =
    step === 0 ? form.name.trim().length > 0 : true;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
          Set up your brand
        </h1>
        <p className="mt-1 text-sm text-sand-500">
          Tell us about your brand so we can tailor your images and copy.
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full transition ${
                i <= step ? "bg-peach-400" : "bg-sand-200"
              }`}
            />
            <p
              className={`mt-1.5 text-xs font-medium ${
                i <= step ? "text-sand-700" : "text-sand-400"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 0: Brand basics */}
        {step === 0 && (
          <div className="space-y-4 rounded-xl border border-sand-200 bg-white p-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-sand-700"
              >
                Brand name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
                placeholder="e.g. AuréLéa"
              />
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isPrivateLabel}
                  onChange={(e) => update("isPrivateLabel", e.target.checked)}
                  className="h-4 w-4 rounded border-sand-300 text-peach-500 focus:ring-peach-300"
                />
                <span className="text-sm text-sand-700">
                  This is a private label brand
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-sand-400">
                Private label brands sell under their own brand name on Amazon.
              </p>
            </div>

            <div>
              <label
                htmlFor="productCategory"
                className="block text-sm font-medium text-sand-700"
              >
                Product category
              </label>
              <input
                id="productCategory"
                type="text"
                value={form.productCategory}
                onChange={(e) => update("productCategory", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition"
                placeholder="e.g. Pilates & Yoga Accessories"
              />
            </div>
          </div>
        )}

        {/* Step 1: Brand DNA */}
        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-sand-200 bg-white p-6">
            <div>
              <label
                htmlFor="dna"
                className="block text-sm font-medium text-sand-700"
              >
                Brand DNA
              </label>
              <p className="mt-0.5 text-xs text-sand-400">
                Describe your brand&apos;s visual identity, mood, and values.
                This shapes how AI generates your images and copy.
              </p>
              <textarea
                id="dna"
                rows={6}
                value={form.dna}
                onChange={(e) => update("dna", e.target.value)}
                className="mt-2 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
                placeholder="e.g. Quiet, refined elegance in movement. Calm, minimal, feminine, and premium. Inspired by Pilates studios, natural light, and Mediterranean softness..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Audience & tone */}
        {step === 2 && (
          <div className="space-y-4 rounded-xl border border-sand-200 bg-white p-6">
            <div>
              <label
                htmlFor="targetAudience"
                className="block text-sm font-medium text-sand-700"
              >
                Target audience
              </label>
              <textarea
                id="targetAudience"
                rows={3}
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
                placeholder="e.g. Women 25-40, health-conscious, design-focused, willing to pay for quality"
              />
            </div>

            <div>
              <label
                htmlFor="tone"
                className="block text-sm font-medium text-sand-700"
              >
                Tone & conversion priorities
              </label>
              <textarea
                id="tone"
                rows={3}
                value={form.tone}
                onChange={(e) => update("tone", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-peach-400 focus:ring-2 focus:ring-peach-200 transition resize-none"
                placeholder="e.g. Elegant but approachable. Prioritize trust, quality perception, and lifestyle aspiration."
              />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="rounded-lg border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-sand-600 shadow-sm hover:bg-sand-50 disabled:opacity-30 transition"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canProceed}
              className="rounded-lg bg-sand-800 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sand-700 disabled:opacity-50 transition"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || !canProceed}
              className="rounded-lg bg-peach-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-peach-400 disabled:opacity-50 transition"
            >
              {busy ? "Creating…" : "Create brand"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
