"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  {
    title: "AI Product Shots",
    description:
      "Drop your product photos, pick a vibe, get studio-quality Amazon images in seconds.",
    icon: "camera",
    span: "col-span-1",
  },
  {
    title: "Listing Copy That Converts",
    description:
      "Optimized titles, bullet points, and descriptions — powered by your brand DNA and keywords.",
    icon: "text",
    span: "col-span-1",
  },
  {
    title: "A+ Content Builder",
    description:
      "Hero banners, comparison charts, feature highlights — structured A+ modules ready for Seller Central.",
    icon: "sparkle",
    span: "col-span-1",
  },
  {
    title: "Brand DNA Engine",
    description:
      "Define your brand once. Every generation stays on-brand — tone, style, and identity baked in.",
    icon: "dna",
    span: "col-span-1",
  },
  {
    title: "Results Dashboard",
    description:
      "Browse, filter, favorite, and reject generated content. Keep what works.",
    icon: "grid",
    span: "col-span-1",
  },
  {
    title: "Pay As You Grow",
    description:
      "Start free. Scale when you're ready. No hidden fees, no contracts.",
    icon: "credit",
    span: "col-span-1",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    features: [
      "50 credits / month",
      "1 brand",
      "3 products",
      "Listing copy",
      "Basic image gen",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "€29",
    period: "/ month",
    features: [
      "500 credits / month",
      "3 brands",
      "20 products",
      "All gen types",
      "A+ content",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "€79",
    period: "/ month",
    features: [
      "2,000 credits / month",
      "Unlimited brands",
      "Unlimited products",
      "All gen types",
      "A+ content",
      "Priority support",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

const STEPS = [
  {
    num: "01",
    title: "Set up your brand",
    desc: "Paste your brand DNA, set your tone, define your audience. Takes 2 minutes.",
  },
  {
    num: "02",
    title: "Upload product photos",
    desc: "Drag and drop your reference images. JPEG, PNG, WebP — whatever you've got.",
  },
  {
    num: "03",
    title: "Generate everything",
    desc: "Hit generate. Get lifestyle shots, listing copy, and A+ content in seconds.",
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: "var(--gs-bg)" }}>
      {/* ── Nav ── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "var(--gs-surface-overlay)",
          borderBottom: "1px solid var(--gs-border-subtle)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white text-sm"
              style={{ background: "var(--gs-accent)" }}
            >
              G
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--gs-text)" }}
            >
              Grip Shot
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="#features"
              className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--gs-text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--gs-text)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-muted)")
              }
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--gs-text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--gs-text)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-muted)")
              }
            >
              Pricing
            </a>

            <ThemeToggle />

            {!loading && user ? (
              <Link href="/dashboard" className="gs-btn-primary px-4 py-2 text-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="gs-btn-primary px-4 py-2 text-sm"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, var(--gs-accent-glow) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{
              background: "var(--gs-accent-subtle)",
              color: "var(--gs-accent-text)",
              border: "1px solid var(--gs-accent-glow)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: "var(--gs-accent)" }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "var(--gs-accent)" }}
              />
            </span>
            Built for Amazon sellers who move fast
          </div>

          <h1
            className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
            style={{
              color: "var(--gs-text)",
              lineHeight: "1.08",
            }}
          >
            Stop paying for
            <br />
            <span
              style={{
                background:
                  "linear-gradient(135deg, var(--gs-accent), #ff9a56)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              mediocre product shots.
            </span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed"
            style={{ color: "var(--gs-text-muted)" }}
          >
            Grip Shot turns your product photos into Amazon-ready lifestyle
            images, listing copy, and A+ content — powered by AI, guided by your
            brand DNA. No studio. No freelancer. No waiting.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/login"
              className="gs-btn-primary px-8 py-3.5 text-base w-full sm:w-auto text-center"
            >
              Start generating — it&apos;s free
            </Link>
            <a
              href="#features"
              className="gs-btn-secondary px-8 py-3.5 text-base w-full sm:w-auto text-center"
            >
              See how it works
            </a>
          </div>

          <p
            className="mt-5 text-xs"
            style={{ color: "var(--gs-text-faint)" }}
          >
            No credit card required &middot; 50 free credits every month
          </p>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section
        className="py-5"
        style={{
          borderTop: "1px solid var(--gs-border-subtle)",
          borderBottom: "1px solid var(--gs-border-subtle)",
          background: "var(--gs-surface)",
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-3 px-6">
          <StatBadge value="10x" label="faster than studio shoots" />
          <div
            className="hidden sm:block h-6 w-px"
            style={{ background: "var(--gs-border)" }}
          />
          <StatBadge value="€0.15" label="avg. cost per image" />
          <div
            className="hidden sm:block h-6 w-px"
            style={{ background: "var(--gs-border)" }}
          />
          <StatBadge value="5 min" label="from upload to listing-ready" />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: "var(--gs-text)" }}
          >
            Everything you need to ship listings faster
          </h2>
          <p className="mt-3" style={{ color: "var(--gs-text-muted)" }}>
            One tool. Product images, listing copy, A+ content. Done.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={`gs-card p-6 ${f.span}`}>
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  background: "var(--gs-accent-subtle)",
                }}
              >
                <FeatureIcon type={f.icon} />
              </div>
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--gs-text)" }}
              >
                {f.title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--gs-text-muted)" }}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        className="py-24"
        style={{
          borderTop: "1px solid var(--gs-border-subtle)",
          borderBottom: "1px solid var(--gs-border-subtle)",
          background: "var(--gs-surface)",
        }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2
            className="text-center text-3xl font-bold sm:text-4xl mb-14"
            style={{ color: "var(--gs-text)" }}
          >
            Three steps. That&apos;s it.
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute right-0 top-8 hidden w-full sm:block"
                    style={{
                      borderBottom: "2px dashed var(--gs-border)",
                      transform: "translateX(50%)",
                      width: "100%",
                    }}
                  />
                )}
                <div
                  className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black"
                  style={{
                    background: "var(--gs-accent-subtle)",
                    color: "var(--gs-accent)",
                  }}
                >
                  {s.num}
                </div>
                <h3
                  className="text-base font-semibold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--gs-text-muted)" }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: "var(--gs-text)" }}
          >
            Simple pricing. No surprises.
          </h2>
          <p className="mt-3" style={{ color: "var(--gs-text-muted)" }}>
            Start free. Upgrade when your business needs it.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="relative gs-card-static p-6"
              style={
                plan.highlighted
                  ? {
                      borderColor: "var(--gs-accent)",
                      boxShadow: "var(--gs-shadow-glow)",
                    }
                  : {}
              }
            >
              {plan.highlighted && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{
                    background: "var(--gs-accent)",
                    color: "var(--gs-text-on-accent)",
                  }}
                >
                  Most popular
                </span>
              )}
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--gs-text)" }}
              >
                {plan.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span
                  className="text-4xl font-bold"
                  style={{ color: "var(--gs-text)" }}
                >
                  {plan.price}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--gs-text-faint)" }}
                >
                  {plan.period}
                </span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: "var(--gs-text-secondary)" }}
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "var(--gs-accent)" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-6 block w-full py-2.5 text-center text-sm font-semibold rounded-lg transition ${
                  plan.highlighted ? "gs-btn-primary" : "gs-btn-secondary"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background:
            "linear-gradient(135deg, var(--gs-accent), #e04810)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Your competitors are already using AI.
          </h2>
          <p className="mt-4 text-white/70">
            Stop spending hours on product photography and copywriting. Start
            shipping listings that actually convert.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-xl bg-white px-10 py-4 text-base font-bold shadow-lg transition hover:shadow-xl"
            style={{ color: "var(--gs-accent)" }}
          >
            Get started for free
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-8"
        style={{
          borderTop: "1px solid var(--gs-border-subtle)",
          background: "var(--gs-surface)",
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--gs-text-muted)" }}
          >
            Grip Shot by FashionMentum
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm transition-colors"
              style={{ color: "var(--gs-text-faint)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-secondary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-faint)")
              }
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm transition-colors"
              style={{ color: "var(--gs-text-faint)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-secondary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--gs-text-faint)")
              }
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="text-sm transition-colors"
              style={{ color: "var(--gs-text-faint)" }}
            >
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
    <div className="flex items-center gap-2.5">
      <span
        className="text-lg font-bold"
        style={{ color: "var(--gs-text)" }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: "var(--gs-text-faint)" }}>
        {label}
      </span>
    </div>
  );
}

function FeatureIcon({ type }: { type: string }) {
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
      className="h-5 w-5"
      style={{ color: "var(--gs-accent)" }}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
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
