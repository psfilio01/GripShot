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
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | Optional | Webhook URL (Cloud Run URL or ngrok URL for local) |
| `GEMINI_API_KEY` | Optional | Gemini API key for intent classification (Telegram bot). Falls back to `NANOBANANA_API_KEY` if unset. |
| `GEMINI_DRY_RUN` | Optional | Set `true` to skip Gemini calls for voice transcription and intent classification. Returns fixed test strings instead. |

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
| `NANOBANANA_MODEL` | No | **Image** model for workflow image steps and listing generation (default: `gemini-3.1-flash-image-preview`). Must support image output; a text-only model ID will fail at runtime. |
| `NANOBANANA_PLANNER_MODEL` | No | **Text-only** model for custom workflow **plan / replan** JSON (default: `gemini-2.5-flash`). Cheaper than image models; changing `NANOBANANA_MODEL` does not change planning. |
| `NANOBANANA_DRY_RUN` | No | Set `true` to skip API calls |

**Monorepo `.env`:** With `pnpm dev`, Next.js loads `packages/web/.env.local` (and `.env` there), not the repo root `.env`. Root `Apps/.env` is merged into `process.env` for keys that are still unset when `next.config.ts` loads and when `workflow-core` initializes, so you can keep Gemini keys in the root file.

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

### Telegram Bot (local development)

The bot receives updates via webhook. For local development, you need a public URL that tunnels to your local machine.

#### Setup

1. **Create a bot via @BotFather** on Telegram. Copy the token.
2. Add to `packages/web/.env.local`:

```env
TELEGRAM_BOT_TOKEN=<your token from BotFather>
TELEGRAM_WEBHOOK_URL=<your tunnel URL>/api/telegram/webhook
```

3. **Start a tunnel** (pick one):

```bash
# Option A: ngrok
ngrok http 3000
# → Copy the https://xxxx.ngrok-free.app URL

# Option B: cloudflared
cloudflared tunnel --url http://localhost:3000
# → Copy the https://xxxx.trycloudflare.com URL
```

4. Set `TELEGRAM_WEBHOOK_URL` to the tunnel URL + `/api/telegram/webhook`.

5. **Register the webhook**:

```bash
npx tsx scripts/telegram-register-webhook.ts
```

6. **Verify**:

```bash
npx tsx scripts/telegram-register-webhook.ts --info
```

#### Dry-run mode (Telegram)

When `GEMINI_DRY_RUN=true` (set in `.env.local`), voice message transcription and intent classification return fixed test strings instead of calling Gemini. The bot still processes commands, sends messages, and links accounts normally.

#### Useful commands

```bash
npx tsx scripts/telegram-register-webhook.ts          # Register webhook
npx tsx scripts/telegram-register-webhook.ts --info    # Show webhook info
npx tsx scripts/telegram-register-webhook.ts --delete  # Remove webhook
```

### Workflow System dry-run

All expensive API calls in the workflow engine and Telegram bot have a dry-run path so you can develop and test without spending Gemini quota.

| Variable | Location | Effect when `true` |
|----------|----------|--------------------|
| `NANOBANANA_DRY_RUN` | root `.env` | Skips Gemini image generation; returns a placeholder PNG instead |
| `GEMINI_DRY_RUN` | `packages/web/.env.local` | Skips voice transcription and intent classification; returns fixed test strings |

**Typical local dev setup** — set both in their respective files to develop entirely offline:

```env
# root .env
NANOBANANA_DRY_RUN=true

# packages/web/.env.local
GEMINI_DRY_RUN=true
```

With dry-run enabled:
- `planWorkflow` returns 3 template steps tagged `[DRY RUN]`
- `replanStep` returns a replacement step tagged `[DRY RUN] Replanned`
- `scoreImageQuality` returns a score of 8/10 with no issues
- Voice transcription returns `"[DRY RUN] Transcribed text"`
- Intent classification always returns `create_workflow` with a description `"[DRY RUN] Create workflow"`

---

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

Set the following **server-only** env vars in the Cloud Run console (`Edit & Deploy New Revision → Variables & Secrets`) or via `gcloud run services update`. They are **not** baked into the client bundle.

#### Required server-side environment variables

| Variable | Source | Notes |
|----------|--------|-------|
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase console → Project settings | |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase service account | |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase service account | Include the full PEM string with newlines as `\n` |
| `STRIPE_SECRET_KEY` | Stripe dashboard → API keys | |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks | |
| `NANOBANANA_API_KEY` | Google AI Studio | Gemini API key for image generation |
| `NANOBANANA_MODEL` | — | Optional; default `gemini-3.1-flash-image-preview` |
| `WORKFLOW_DATA_ROOT` | — | e.g. `/tmp/data` (ephemeral); prefer GCS for durability |
| `WORKFLOW_GCS_BUCKET` | GCS | Recommended for Cloud Run — see Blob Storage section |
| `TELEGRAM_BOT_TOKEN` | BotFather | Required for Telegram bot |
| `ADMIN_UIDS` | Firebase Auth | Comma-separated UIDs for unlimited admin access |
| `LOG_LEVEL` | — | Optional; `debug` / `info` (default) / `warn` / `error` |

#### Post-deploy checklist

1. **Stripe webhooks:** point to `https://YOUR_HOST/api/billing/webhook`.
2. **Telegram webhook:** register after every deploy or URL change:
   ```bash
   TELEGRAM_WEBHOOK_URL=https://YOUR_HOST/api/telegram/webhook npx tsx scripts/telegram-register-webhook.ts
   ```
   Verify with:
   ```bash
   TELEGRAM_WEBHOOK_URL=https://YOUR_HOST/api/telegram/webhook npx tsx scripts/telegram-register-webhook.ts --info
   ```
3. **Firebase Authentication → Authorized domains:** include your `*.run.app` host and any custom domain.

### Google sign-in (production)

The app uses **`signInWithPopup`**. **`next.config.ts`** sets **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** so the OAuth popup can close cleanly on Cloud Run.

### Blob storage (GCS)

Set **`WORKFLOW_GCS_BUCKET`** (root `.env` and Cloud Run env) so reference images, human-model assets, backgrounds, and generated outputs live in **Google Cloud Storage** instead of the container disk. Object keys mirror paths under `data/` (e.g. `products/{id}/reference/...`, `generated/...`). **Costs** are typical GCS storage + operations; serving still goes through `/api/images/...` (app egress applies). Job metadata remains in **`metadata.json`** under `WORKFLOW_DATA_ROOT` unless you move it to Firestore later.

Without **`WORKFLOW_GCS_BUCKET`**, the app keeps using **local disk** under `WORKFLOW_DATA_ROOT` (fine for dev; **not** durable on Cloud Run).

**Local dev with GCS:** Run `gcloud auth application-default login` in the same GCP project as the bucket (or set **`GOOGLE_APPLICATION_CREDENTIALS`** to a service account JSON). If ADC is missing, uploads fail after generation and you may see `MetadataLookupWarning` for `169.254.169.254` (the GCE metadata server is not reachable on a laptop).

### Build pipeline (CI)

Suggested order: install → lint → typecheck → test → **`pnpm deploy:cloud-run`** (or build/push + deploy in separate CI steps) → smoke test.

---

## Dashboard API errors (maintainers)

Generate-tab fetch handlers use `readFetchResponseBody` and `messageFromApiFailure` in `packages/web/src/lib/api/fetch-response-body.ts`. That way callers still show useful text when the response is not JSON (e.g. proxy HTML) while preferring `{ "error": "..." }` from Next API routes.
