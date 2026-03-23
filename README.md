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
| Billing toast notifications | Done |
| Product card quick actions | Done |
| Results page image traceability | Done |
| Hero Lock — color variant generation | Done |
| Human models setup + lifestyle model picker | Done |
| Playwright E2E: human models flow (optional auth) | Done |
| Admin / superuser with unlimited access | Done |
| Structured generation logging + admin logs UI | Done |
| Generate tabs: robust API error messages (JSON + non-JSON bodies) | Done |

---

## Human models (lifestyle shots)

Create **Models** in the dashboard with a display name and optional notes. Upload **reference photos** to `data/models/{modelId}/reference/`. For **Amazon lifestyle** generation, choose a specific model or **Random** to pick from your workspace’s models only (never another tenant’s folders). Workspace model IDs are stored in Firestore (`humanModels`); the API validates `modelId` before each job.

---

## Hero Lock — Color Locked Variant Generation

When an Amazon seller finds a generated image they love, they typically need the same creative in every product color. **Hero Lock** solves this:

1. **Configure product colors** — On the product detail page, define colors with name, hex code, optional notes, and SKU.
2. **Hero Lock an image** — In the results dashboard, click the Hero Lock button on any neutral image. This locks it as the master asset.
3. **Automatic recolor generation** — The system extracts a structured "SceneLock" (image DNA) from the master, then generates same-scene variants for each configured color — keeping pose, composition, lighting, background, and styling identical. Only the product color changes.
4. **Lineage tracking** — Every variant stores its parent master ID, target color, generation method, and status. The dashboard shows clear lineage: which image is the master and which are derived variants.

### Technical approach

- **Scene extraction** uses `gemini-2.5-flash` with structured JSON output (`responseMimeType: "application/json"` + JSON schema) to analyze the hero image and produce a typed `SceneLock` object containing scene description, subject, product placement, composition, camera, lighting, background, protected invariants, and detected product color.
- **Recolor generation** uses the configured image model (e.g. `gemini-3.1-flash-image-preview`) to edit the master image with an invariant-focused recolor prompt. The prompt explicitly lists elements that must not change and specifies only the target color change.
- **Fallback behavior**: If the model cannot guarantee pixel-perfect invariance (which generative models cannot), the SceneLock data serves as audit metadata and prompt guidance. The system builds the strongest reliability layer possible: invariant-focused prompts, structured scene analysis, validation, lineage tracking, and per-variant status tracking.
- **Original color skip**: If a configured color matches the detected original color, it is automatically skipped to avoid duplicate generation.

### Key files

| File | Purpose |
|------|---------|
| `packages/workflow-core/src/domain/sceneLock.ts` | SceneLock type + JSON schema + validator |
| `packages/workflow-core/src/services/sceneExtractor.ts` | Gemini structured output extraction |
| `packages/workflow-core/src/services/recolorGenerator.ts` | Gemini image editing for recolor |
| `packages/workflow-core/src/services/heroLockOrchestrator.ts` | Full Hero Lock workflow orchestration |
| `packages/web/src/lib/db/product-colors.ts` | Product color CRUD + Zod validation |
| `packages/web/src/app/api/products/[productId]/colors/route.ts` | Colors REST API |

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

Optional admin and logging variables:

| Variable | Purpose |
|----------|---------|
| `ADMIN_UIDS` | Comma-separated Firebase UIDs for admin access (unlimited, no quota) |
| `LOG_LEVEL` | Logging level: `debug`, `info` (default), `warn`, `error` |

For the workflow engine, also set variables in the root `.env` (see `.env.example`).

| `WORKFLOW_DATA_ROOT` | Optional. Absolute path to the repo `data/` folder. If unset, the engine uses repo `data/` when Next runs from `packages/web`, and the image API also falls back to `packages/web/data` so older generated files still load. **Recommended:** set once to your monorepo `data` directory to avoid split storage. |

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

**Playwright:** Smoke tests (login redirect, login form) run without extra setup. The **human models** flow (`e2e/human-models.spec.ts`) is **skipped** unless you set a Firebase **email/password** test user:

```bash
cd packages/web
export E2E_EMAIL="your-test-user@example.com"
export E2E_PASSWORD="your-secure-password"
pnpm test:e2e
```

Requires valid `packages/web/.env.local` (Firebase client + Admin) so the dev server can sign in and write to Firestore. Each run creates a uniquely named model in that user’s workspace (safe to delete later from **Models**).

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

### Admin / Superuser

Set `ADMIN_UIDS` in your `.env` (comma-separated Firebase UIDs) to grant unlimited access to specific accounts. Admin users:

- **Skip all quota checks** — generation never blocked by credits
- **Skip credit consumption** — no credits deducted for any generation
- **Bypass plan limits** — unlimited brands, products, A+ content access
- **See the "Gen Logs" page** — admin-only dashboard for browsing full generation prompts

Admin status is resolved exclusively server-side from the env var. There is no Firestore field to manipulate and no client-side exposure beyond a UI badge. Safe for production — admin privileges cannot be escalated through the database.

```bash
# In .env or .env.local
ADMIN_UIDS=abc123FirebaseUid,def456AnotherUid
```

---

## Generation logging

Every generation (image, listing copy, A+ content, background, human model) is logged to Firestore with:

- Full prompt text
- Input parameters
- Model used, aspect ratio, resolution
- Duration (ms)
- Success/failure status and error messages
- User and workspace context

### Admin logs dashboard

Navigate to **Gen Logs** in the sidebar (admin only) to browse all generation activity. Each log entry expands to show:

- Full prompt (with copy button)
- Input parameters as JSON
- Timing, model, and metadata
- Error details for failed generations

### Console logging

The app uses a structured logger with configurable levels:

```bash
# In .env or .env.local (default: info)
LOG_LEVEL=debug
```

In development, logs are colorized with timestamps and scoped labels. In production, logs are JSON for aggregation. The workflow-core engine also logs full prompts to the console with clear delimiters (`── FULL PROMPT ──` / `── END PROMPT ──`).

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
- **Duplicate product folder names:** URLs use the Firestore product id (e.g. `pilates-mini-ball`). If older runs wrote files under a human-readable folder (e.g. `Pilates Mini Ball`), the API still resolves images by scanning `data/generated/*/<jobId>/...`. To clean disk and metadata, merge into the canonical id folder:

  `pnpm merge-product-folders "Pilates Mini Ball" pilates-mini-ball`

  (Optional third arg: absolute path to `data/` if not repo `data/`.)

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
- **In-flight image generations**: while Gemini is working, each run appears as a placeholder card with an indeterminate progress bar (shown when the status filter is “All”). The list refreshes every few seconds until the job completes; failed runs can be dismissed.
- Download individual images via hover overlay button
- Bulk download filtered results as ZIP via the "Download ZIP" button
- Skeleton loading animation while results load
- Toast notifications for downloads and feedback actions

---

## Image generation

- **Parallel runs**: you can start another image generation while one is still in flight; the Generate tab stays usable and shows how many runs are active with a link to **Results** for live placeholders.
- Each request sends a client `requestId` (UUID) so pending state lines up with placeholders; optional `DELETE /api/generate/image/pending/[requestId]` removes a failed placeholder from the dashboard.
- On failure, errors are surfaced via **toast** with the same detailed API/Gemini messaging as other tabs (`readFetchResponseBody` / `messageFromApiFailure`).
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
| B | Brands |
| P | Products |
| M | Models |
| K | Backgrounds |
| G | Generate |
| R | Results |
| S | Settings |
| L | Gen Logs (admin only) |

---

## Theme system

- Light and dark mode with a visible toggle on all pages
- Token-based CSS custom properties (`--gs-*`) for consistent theming
- Preference persists to `localStorage` and applies before hydration (no flash)
- Both themes are independently designed — not just inverted colors

---

## Shared UI components

| Component | File | Purpose |
|-----------|------|---------|
| ConfirmDialog | `components/confirm-dialog.tsx` | Accessible modal for destructive actions |
| EmptyState | `components/empty-state.tsx` | Friendly placeholder with CTA for empty pages |
| ToastProvider | `components/toast.tsx` | Global non-blocking notification system |
| Skeleton | `components/skeleton.tsx` | Loading state placeholders |
| ZoomableImage | `components/zoomable-image.tsx` | Click-to-zoom image viewer |

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
