# Local Development and Deployment

## Local development goals

The project supports two modes:

1. **Local developer mode** — fast iteration with `pnpm dev`
2. **Production mode** — Cloud Run deployment (planned)

---

## Setup

### Prerequisites

- Node.js 18+
- pnpm 9+

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
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin (no trailing slash) for SEO metadata: canonical URLs and `hreflang` alternates (`/en`, `/de`). Use your Firebase Hosting or custom domain in production. |
| `FIREBASE_ADMIN_PROJECT_ID` | Yes | Firebase Admin (server-side auth) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Yes | Firebase Admin |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Yes | Firebase Admin |
| `STRIPE_SECRET_KEY` | Later | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Later | Stripe webhooks |

#### Workflow engine (root `.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `WORKFLOW_DATA_ROOT` | Yes | Path to the `data/` directory |
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

### Internationalization (EN / DE)

- **Library:** [next-intl](https://next-intl-docs.vercel.app/) with **always-on** locale prefixes (best practice for SEO: separate crawlable URLs per language).
- **Messages:** `packages/web/src/messages/en.json` and `de.json`. Add keys to **both** files when introducing new copy.
- **Navigation:** Use `Link`, `useRouter`, and `usePathname` from `@/i18n/navigation` so internal links keep the active locale.
- **Firebase Hosting / Cloud Run:** No extra rewrite rules are required for locales beyond forwarding all non-static paths to your Next server (same as a single-locale app). Ensure **`NEXT_PUBLIC_APP_URL`** matches your deployed origin so metadata alternates are correct.

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

**Optional authenticated flows** (`human-models.spec.ts`, `results-dashboard.spec.ts`): export `E2E_EMAIL` and `E2E_PASSWORD` for a Firebase email/password user; without them those tests are skipped so CI and local runs stay green.

If port `3000` is already in use (e.g. `pnpm dev` running), unset `CI` for that shell so Playwright’s `reuseExistingServer` applies; with `CI=true`, it always tries to start a second server and may fail on the busy port.

---

## Building

```bash
pnpm build             # All packages
pnpm build:web         # Next.js production build
pnpm build:core        # workflow-core TypeScript build
```

---

## Dashboard API errors (maintainers)

Generate-tab fetch handlers use `readFetchResponseBody` and `messageFromApiFailure` in `packages/web/src/lib/api/fetch-response-body.ts`. That way callers still show useful text when the response is not JSON (e.g. proxy HTML) while preferring `{ "error": "..." }` from Next API routes.

---

## Docker guidance (planned)

Containerize from a single Dockerfile at the repo root:

- One container for the Next.js app
- External services: Firebase Auth, Firestore, Cloud Storage, Stripe

No durable state on the container filesystem.

## Cloud Run deployment (planned)

The app must remain stateless:

- Firestore for metadata
- Cloud Storage for files
- Stripe for billing
- Firebase Auth for identity

Build pipeline: install → lint → typecheck → test → build container → deploy → smoke test.
