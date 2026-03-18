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

Opens at http://localhost:3000.

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

---

## Building

```bash
pnpm build             # All packages
pnpm build:web         # Next.js production build
pnpm build:core        # workflow-core TypeScript build
```

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
