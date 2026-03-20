"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

const FEATURES = [
  {
    title: "AI Product Shots",
    description:
      "Drop in your product photos, pick a vibe, and get studio-quality Amazon images in seconds. No photographer needed.",
    icon: "camera",
  },
  {
    title: "Listing Copy That Converts",
    description:
      "Generate optimized titles, bullet points, and descriptions powered by your brand DNA and target keywords.",
    icon: "text",
  },
  {
    title: "A+ Content Builder",
    description:
      "Hero banners, comparison charts, feature highlights — structured A+ content modules ready for Seller Central.",
    icon: "sparkle",
  },
  {
    title: "Brand DNA Engine",
    description:
      "Define your brand once. Every generation stays on-brand automatically — tone, style, and visual identity baked in.",
    icon: "dna",
  },
  {
    title: "Results Dashboard",
    description:
      "Browse, filter, favorite, and reject generated content. Keep what works, ditch what doesn't.",
    icon: "grid",
  },
  {
    title: "Usage-Based Pricing",
    description:
      "Start free. Scale when you're ready. No hidden fees, no contracts, no surprises.",
    icon: "credit",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    features: ["50 credits/month", "1 brand", "3 products", "Listing copy", "Basic image gen"],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "€29",
    period: "/month",
    features: ["500 credits/month", "3 brands", "20 products", "All gen types", "A+ content", "Priority support"],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "€79",
    period: "/month",
    features: ["2,000 credits/month", "Unlimited brands", "Unlimited products", "All gen types", "A+ content", "Priority support"],
    cta: "Go Pro",
    highlighted: false,
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-sand-200/60 bg-sand-50/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight text-sand-800">
            Grip Shot
          </span>
          <div className="flex items-center gap-4">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-sand-800 px-5 py-2 text-sm font-medium text-white hover:bg-sand-700 transition"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-sand-600 hover:text-sand-800 transition"
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg bg-sand-800 px-5 py-2 text-sm font-medium text-white hover:bg-sand-700 transition"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <div className="inline-block rounded-full bg-peach-100 px-4 py-1.5 text-xs font-semibold text-peach-500 mb-6">
          Built for Amazon sellers who move fast
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-sand-900 sm:text-6xl lg:text-7xl leading-[1.1]">
          Stop paying for
          <br />
          <span className="bg-gradient-to-r from-peach-400 to-peach-500 bg-clip-text text-transparent">
            mediocre product shots.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-sand-500 leading-relaxed">
          Grip Shot turns your product photos into Amazon-ready lifestyle
          images, listing copy, and A+ content — powered by AI, guided by your
          brand DNA. No studio. No freelancer. No waiting.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-sand-800 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sand-800/20 hover:bg-sand-700 transition"
          >
            Start generating — it&apos;s free
          </Link>
          <a
            href="#features"
            className="rounded-xl border-2 border-sand-300 px-8 py-3.5 text-base font-semibold text-sand-700 hover:border-sand-400 hover:bg-white transition"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-sand-400">
          No credit card required. 50 free credits every month.
        </p>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-sand-200 bg-white py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-3 px-6">
          <StatBadge value="10x" label="faster than studio shoots" />
          <StatBadge value="€0.15" label="avg. cost per image" />
          <StatBadge value="5 min" label="from upload to listing-ready" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-sand-800 sm:text-4xl">
            Everything you need to ship listings faster
          </h2>
          <p className="mt-3 text-sand-500">
            One tool. Product images, listing copy, A+ content. Done.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-sand-200 bg-white p-6 hover:border-sand-300 hover:shadow-md transition"
            >
              <FeatureIcon type={f.icon} />
              <h3 className="mt-4 text-base font-semibold text-sand-800">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-sand-500 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-sand-200 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold text-sand-800 sm:text-4xl mb-12">
            Three steps. That&apos;s it.
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <StepCard
              number="01"
              title="Set up your brand"
              description="Paste your brand DNA, set your tone, define your audience. Takes 2 minutes."
            />
            <StepCard
              number="02"
              title="Upload product photos"
              description="Drag and drop your reference images. JPEG, PNG, WebP — whatever you've got."
            />
            <StepCard
              number="03"
              title="Generate everything"
              description="Hit generate. Get lifestyle shots, listing copy, and A+ content in seconds."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-sand-800 sm:text-4xl">
            Simple pricing. No surprises.
          </h2>
          <p className="mt-3 text-sand-500">
            Start free. Upgrade when your business needs it.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 ${
                plan.highlighted
                  ? "border-peach-300 bg-peach-50/40 shadow-lg shadow-peach-200/30 ring-1 ring-peach-200"
                  : "border-sand-200 bg-white"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-block rounded-full bg-peach-500 px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-sand-800">
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-sand-800">
                  {plan.price}
                </span>
                <span className="text-sm text-sand-400">{plan.period}</span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-sand-600"
                  >
                    <span className="mt-0.5 text-peach-500 shrink-0">
                      &#10003;
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition ${
                  plan.highlighted
                    ? "bg-peach-500 text-white hover:bg-peach-400"
                    : "border border-sand-300 text-sand-700 hover:bg-sand-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-sand-800 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Your competitors are already using AI.
          </h2>
          <p className="mt-4 text-sand-300">
            Stop spending hours on product photography and copywriting.
            Start shipping listings that actually convert.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-xl bg-peach-500 px-10 py-4 text-base font-semibold text-white shadow-lg hover:bg-peach-400 transition"
          >
            Get started for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sand-200 bg-sand-50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <span className="text-sm font-medium text-sand-500">
            Grip Shot by FashionMentum
          </span>
          <div className="flex gap-6 text-sm text-sand-400">
            <a href="#features" className="hover:text-sand-600 transition">
              Features
            </a>
            <a href="#pricing" className="hover:text-sand-600 transition">
              Pricing
            </a>
            <Link href="/login" className="hover:text-sand-600 transition">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold text-sand-800">{value}</span>
      <span className="text-xs text-sand-400">{label}</span>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <span className="inline-block text-5xl font-black text-peach-200">
        {number}
      </span>
      <h3 className="mt-2 text-base font-semibold text-sand-800">{title}</h3>
      <p className="mt-2 text-sm text-sand-500">{description}</p>
    </div>
  );
}

function FeatureIcon({ type }: { type: string }) {
  const iconClass = "h-8 w-8 text-peach-400";

  const paths: Record<string, string> = {
    camera:
      "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z",
    text: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    sparkle:
      "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z",
    dna: "M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    grid: "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z",
    credit:
      "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z",
  };

  return (
    <svg
      className={iconClass}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={paths[type] ?? paths.sparkle}
      />
    </svg>
  );
}
