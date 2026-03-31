# Local Development and Deployment

## Local development goals

The project supports two modes:

1. **Local developer mode** — fast iteration with `pnpm dev`
2. **Production mode** — Docker image on **Google Cloud Run**

---

## Setup

### Prerequisites

- Node.js 18+
- pnpm 9+
- For Cloud Run: **Docker Desktop**, **Google Cloud SDK** (`gcloud`), GCP project with **billing** enabled

### Install dependencies

```bash
pnpm install
```

### Environment variables

#### Web app (`packages/web/.env.local`)

Copy from the example:

```bash
cp packages/web/.env.local.example packages/web/.env.local
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase client SDK |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin (no trailing slash) for SEO metadata: canonical URLs and `hreflang` alternates (`/en`, `/de`). Use `http://localhost:3000` locally; production URL is set via `.env.deploy` when building the Docker image. |
| `FIREBASE_ADMIN_PROJECT_ID` | Yes | Firebase Admin (server-side auth) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Yes | Firebase Admin |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Yes | Firebase Admin |
| `STRIPE_SECRET_KEY` | Later | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Later | Stripe webhooks |

#### Production Docker build override (`packages/web/.env.deploy`)

For **`pnpm deploy:cloud-run`** (and any manual `docker-build-push` that loads the same flow), create a **gitignored** file so the client bundle gets the real public URL:

```bash
cp packages/web/.env.deploy.example packages/web/.env.deploy
```

Set at least:

```env
NEXT_PUBLIC_APP_URL=https://YOUR-SERVICE-HASH.REGION.run.app
```

This file is sourced **after** `.env.local`, so it overrides `NEXT_PUBLIC_APP_URL` for the image build only.

Optional keys: `REGION`, `CLOUD_RUN_SERVICE`, `ARTIFACT_REPO`, `PROJECT_ID`, `IMAGE` — see `.env.deploy.example`.

#### Workflow engine (root `.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `WORKFLOW_DATA_ROOT` | Yes | Path to the `data/` directory (still used for `metadata.json`, brand files on disk, and as fallback when GCS is off) |
| `WORKFLOW_GCS_BUCKET` | No | GCS bucket name (e.g. Firebase default bucket `PROJECT_ID.appspot.com`). When set, reference uploads, models, backgrounds, and generated images use this bucket with keys mirroring `data/` paths. **Recommended for Cloud Run.** |
| `NANOBANANA_API_KEY` | Yes | Google Gemini API key |
| `NANOBANANA_MODEL` | No | Gemini model ID (default: `gemini-3.1-flash-image-preview`) |
| `NANOBANANA_DRY_RUN` | No | Set `true` to skip API calls |

---

## Running locally

### Web app

```bash
pnpm dev
```

Opens at http://localhost:3000. Marketing and app routes use a **locale prefix**: **`/en/...`** and **`/de/...`** (default redirect sends `/` → `/en`). API routes stay under `/api/*` without a locale.

Use **`http://localhost:3000`** consistently (not `127.0.0.1`) so session cookies match.

### Internationalization (EN / DE)

- **Library:** [next-intl](https://next-intl-docs.vercel.app/) with **always-on** locale prefixes (best practice for SEO: separate crawlable URLs per language).
- **Messages:** `packages/web/src/messages/en.json` and `de.json`. Add keys to **both** files when introducing new copy.
- **Navigation:** Use `Link`, `useRouter`, and `usePathname` from `@/i18n/navigation` so internal links keep the active locale.
- **Cloud Run:** No extra rewrite rules are required for locales beyond forwarding all non-static paths to your Next server. Ensure **`NEXT_PUBLIC_APP_URL`** in the **built** image matches your deployed origin.

### CLI workflow (image generation)

```bash
pnpm exec ts-node test-start-job.ts
```

---

## Testing

### Unit tests (Vitest)

```bash
pnpm test              # All packages
pnpm test:web          # Web package only
```

### E2E tests (Playwright)

```bash
pnpm test:e2e
```

Playwright auto-starts the dev server on port 3000.

**Optional authenticated flows** (`human-models.spec.ts`, `results-dashboard.spec.ts`, login smoke): export `E2E_EMAIL` and `E2E_PASSWORD` for a Firebase email/password user; without them those tests are skipped so CI and local runs stay green.

If port `3000` is already in use (e.g. `pnpm dev` running), either unset `CI` for that shell so Playwright’s `reuseExistingServer` applies, or set **`PW_REUSE_SERVER=1`** (see `packages/web/playwright.config.ts`).

---

## Building

```bash
pnpm build             # All packages
pnpm build:web         # Next.js production build
pnpm build:core        # workflow-core TypeScript build
```

---

## Docker and Cloud Run

### What gets built

- **Root `Dockerfile`**: multi-stage build, **Next.js `output: "standalone"`**, **`linux/amd64`** (required by Cloud Run).
- **`NEXT_PUBLIC_*`** variables are passed as **Docker build-args** in the builder stage — they are **inlined at `next build` time**. Setting them only on the Cloud Run service at runtime does **not** update the browser bundle.

### Scripts

| Command | Purpose |
|---------|---------|
| `pnpm docker:push:cloud-run` | `docker buildx build` (no attestations) + push to Artifact Registry. Requires `IMAGE` and all `NEXT_PUBLIC_*` exports (e.g. from `.env.local` + `NEXT_PUBLIC_APP_URL` for prod). |
| `pnpm deploy:cloud-run` | Sources `.env.local` and `.env.deploy`, configures Docker auth, runs `docker:push:cloud-run`, then **`gcloud run deploy`**. |

One-time / occasional:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create grip-shot --repository-format=docker --location=REGION
gcloud auth configure-docker REGION-docker.pkg.dev
```

### Full deploy (typical)

```bash
cp packages/web/.env.deploy.example packages/web/.env.deploy
# Edit .env.deploy: set NEXT_PUBLIC_APP_URL to your Cloud Run URL (no trailing slash)

pnpm deploy:cloud-run
```

### Cloud Run service configuration

- Set **server-only** env vars in the Cloud Run console or `gcloud` (e.g. `FIREBASE_ADMIN_*`, `STRIPE_*`, `NANOBANANA_API_KEY`, …). They are **not** baked into the client bundle.
- **Stripe webhooks:** point to `https://YOUR_HOST/api/billing/webhook`.
- **Firebase Authentication → Authorized domains:** include your `*.run.app` host and any custom domain.

### Google sign-in (production)

The app uses **`signInWithPopup`**. **`next.config.ts`** sets **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** so the OAuth popup can close cleanly on Cloud Run.

### Blob storage (GCS)

Set **`WORKFLOW_GCS_BUCKET`** (root `.env` and Cloud Run env) so reference images, human-model assets, backgrounds, and generated outputs live in **Google Cloud Storage** instead of the container disk. Object keys mirror paths under `data/` (e.g. `products/{id}/reference/...`, `generated/...`). **Costs** are typical GCS storage + operations; serving still goes through `/api/images/...` (app egress applies). Job metadata remains in **`metadata.json`** under `WORKFLOW_DATA_ROOT` unless you move it to Firestore later.

Without **`WORKFLOW_GCS_BUCKET`**, the app keeps using **local disk** under `WORKFLOW_DATA_ROOT` (fine for dev; **not** durable on Cloud Run).

### Build pipeline (CI)

Suggested order: install → lint → typecheck → test → **`pnpm deploy:cloud-run`** (or build/push + deploy in separate CI steps) → smoke test.

---

## Dashboard API errors (maintainers)

Generate-tab fetch handlers use `readFetchResponseBody` and `messageFromApiFailure` in `packages/web/src/lib/api/fetch-response-body.ts`. That way callers still show useful text when the response is not JSON (e.g. proxy HTML) while preferring `{ "error": "..." }` from Next API routes.
