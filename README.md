# Grip Shot — Amazon Seller SaaS

> *You hand it your product photos, whisper a few creative ideas, and it comes back with Amazon-ready lifestyle images that look like they were shot in a Mediterranean Pilates studio at golden hour. No photographer required — just vibes, rules, and a very opinionated AI.*

Grip Shot is an AI-powered SaaS for Amazon sellers. It combines product image generation, listing copy, A+ content, and a results dashboard in one workflow — built on Next.js, Firebase, Stripe, and Google Gemini.

---

## Current status

| Milestone | Status |
|-----------|--------|
| Monorepo + workflow-core engine | Done |
| Next.js app shell | Done |
| Firebase Auth (email + Google) | Done |
| Protected dashboard with sidebar | Done |
| Vitest unit tests | Done |
| Playwright smoke test config | Done |
| Firestore data model + user provisioning | Done |
| Brand onboarding flow | Done |
| Listing copy generation | Done |
| Product management | Done |
| Image generation UI (workflow-core bridge) | Done |
| Results dashboard (browse, filter, favorite, reject) | Done |
| Stripe billing + quota enforcement | Done |
| Product reference image upload | Done |
| A+ content generation | Done |
| Brand & product edit/delete | Done |
| Image zoom/lightbox | Done |
| Public landing page | Done |
| Dockerfile + Cloud Run readiness | Done |
| Light/dark theme system | Done |
| Results filtering + image download | Done |
| Image generation controls (aspect ratio, resolution) | Done |
| Product detail: generated image gallery | Done |
| Bulk ZIP download for results | Done |
| Listing copy per-section copy buttons | Done |
| Dashboard recent activity feed | Done |
| Keyboard navigation shortcuts | Done |
| Toast notification system | Done |
| Skeleton loading states | Done |
| Credit top-up purchases | Done |
| Product image categorization | Done |
| Confirm dialog for destructive actions | Done |
| Empty state components | Done |
| Product selector in image generation | Done |
| Generation pre-fill via URL params | Done |
| Job grouping + timestamps on product page | Done |
| Workspace generation preferences | Done |

---

## Project structure

```
.
├── packages/
│   ├── web/                    # Next.js App Router — the SaaS UI
│   │   ├── src/app/            # Pages and layouts
│   │   ├── src/lib/            # Firebase, auth, shared utilities
│   │   ├── e2e/                # Playwright tests
│   │   └── vitest.config.ts    # Unit test config
│   └── workflow-core/          # Image generation engine (Grip Shot)
│       └── src/
│           ├── api/            # workflowFacade — main entry point
│           ├── services/       # Prompt builder, Gemini API, loaders
│           ├── domain/         # Product, Job, Prompt types
│           └── config/         # Environment schema
├── data/                       # Local data (products, models, brand DNA)
├── runtime/                    # Runtime JSON for OpenClaw / manual runs
├── docs/                       # Architecture and deployment docs
└── .env                        # Environment variables (not committed)
```

---

## Quick start

### Prerequisites

- Node.js 18+
- pnpm

### Install

```bash
pnpm install
```

### Configure environment

Copy the example and fill in your credentials:

```bash
cp packages/web/.env.local.example packages/web/.env.local
```

Required variables for the web app:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client SDK |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin (server) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin (server) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin (server) |
| `STRIPE_SECRET_KEY` | Stripe billing (server) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` | Stripe Starter plan price ID |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | Stripe Pro plan price ID |

For the workflow engine, also set variables in the root `.env` (see `.env.example`).

### Run the web app

```bash
pnpm dev
```

Opens at [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `/login`.

### Run tests

```bash
pnpm test              # All unit tests (Vitest)
pnpm test:web          # Web package unit tests
pnpm test:e2e          # Playwright E2E tests
```

### Build

```bash
pnpm build             # Build all packages
pnpm build:web         # Build web only
pnpm build:core        # Build workflow-core only
```

---

## Grip Shot image engine

The workflow-core package builds every image prompt from four layers:

| Layer | Source | Purpose |
|-------|--------|---------|
| Defaults | Hardcoded + `data/brand/aurelea/dna.md` | Base visual style |
| Runtime JSON | `runtime/run_input.json` | Per-run creative direction |
| Global hard rules | `data/brand/aurelea/hard-rules.md` | Brand guardrails |
| Product hard rules | `data/products/<id>/hard-rules.md` | Product constraints |

See `USAGE.md` for full details on the image generation CLI workflow.

---

## Auth and user provisioning

- **Email/password** and **Google sign-in** via Firebase Authentication
- Session cookies managed server-side via `/api/auth/session`
- Middleware redirects unauthenticated users to `/login`
- First sign-in automatically creates a Firestore user document and workspace
- Each user gets a workspace with a free-tier quota (50 credits)

---

## A+ content generation

- Five Amazon A+ module templates: Hero Banner, Feature Highlights, Comparison Chart, Brand Story, Technical Specifications
- AI generates structured JSON content tailored to each module type, using brand DNA and product context
- Rich result rendering: feature cards, comparison tables, spec lists, brand value tags
- Copy-to-clipboard for direct use in Amazon Seller Central
- Quota-enforced — consumes one credit per generation

---

## Product reference images

- Upload JPEG, PNG, or WebP reference images (max 10 MB each) via drag-and-drop or file picker
- **Image categories**: primary, logo, packaging, angle, detail, other — assignable during upload or inline on each image
- Category metadata stored in `.metadata.json` alongside images (backward compatible with uncategorized images)
- Images are stored in `data/products/<productId>/reference/` — directly used by the workflow-core engine
- Product cards link to a detail page showing product info and an image gallery
- The image serving route supports both generated images (`data/generated/`) and product reference images (`data/products/`)

---

## Billing and quotas

- Three plans: **Free** (50 credits/mo), **Starter** (500 credits, €29/mo), **Pro** (2,000 credits, €79/mo)
- **Credit top-ups**: Buy extra credits via one-time Stripe payments (100 for €9, 500 for €39, 1,500 for €99)
- Stripe Checkout for upgrades and credit purchases, Stripe Billing Portal for subscription management
- Webhook handler processes subscription lifecycle events and credit top-up completions
- Quota automatically resets on each billing cycle via `invoice.payment_succeeded`
- Generation routes check credits before running and consume one credit per successful generation
- Settings page shows plan info, a usage bar, credit pack cards, and upgrade/manage buttons

---

## Results dashboard

- Filter by status (all, neutral, favorites, rejected), product, and workflow type
- Download individual images via hover overlay button
- Bulk download filtered results as ZIP via the "Download ZIP" button
- Skeleton loading animation while results load
- Toast notifications for downloads and feedback actions

---

## Image generation

- Select product, workflow type (product shot or lifestyle), aspect ratio, and resolution from the UI
- Aspect ratio options: 4:5 (Amazon main), 1:1, 3:4, 16:9, 9:16, 2:3, 3:2
- Resolution options: 512px, 1K, 2K (default), 4K
- Values passed through to the workflow-core engine and override runtime JSON defaults

---

## Keyboard shortcuts

Press these keys anywhere in the dashboard (when no input is focused):

| Key | Destination |
|-----|-------------|
| H | Overview |
| P | Products |
| G | Generate |
| R | Results |
| S | Settings |

---

## Theme system

- Light and dark mode with a visible toggle on all pages
- Token-based CSS custom properties (`--gs-*`) for consistent theming
- Preference persists to `localStorage` and applies before hydration (no flash)
- Both themes are independently designed — not just inverted colors

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, Tailwind CSS 4 |
| Auth | Firebase Authentication |
| Database | Firestore |
| Storage | Cloud Storage for Firebase (planned) |
| Billing | Stripe |
| Image generation | Google Gemini API |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Deployment | Cloud Run (planned) |
