#!/usr/bin/env bash
# Build linux/amd64 image for Cloud Run and push to Artifact Registry.
# Plain `docker build` on Docker Desktop can produce an OCI image index (attestations)
# that Cloud Run rejects; this uses buildx with provenance/SBOM disabled.
#
# Next.js bakes NEXT_PUBLIC_* into the client JS at build time. Load them before running, e.g.:
#   set -a && source packages/web/.env.local && set +a
#   export NEXT_PUBLIC_APP_URL=https://YOUR-SERVICE-xxxxx.run.app   # production URL, no trailing slash
#   export IMAGE=... && pnpm docker:push:cloud-run
set -euo pipefail

: "${IMAGE:?Set IMAGE, e.g. europe-west1-docker.pkg.dev/PROJECT/grip-shot/web:latest}"

: "${NEXT_PUBLIC_FIREBASE_API_KEY:?Set NEXT_PUBLIC_FIREBASE_API_KEY (see script header)}"
: "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}"
: "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:?Set NEXT_PUBLIC_FIREBASE_PROJECT_ID}"
: "${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:?Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}"
: "${NEXT_PUBLIC_FIREBASE_APP_ID:?Set NEXT_PUBLIC_FIREBASE_APP_ID}"
: "${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL to your public Cloud Run URL (no trailing slash)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  --build-arg "NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --build-arg "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}" \
  --build-arg "NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=${NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID:-}" \
  --build-arg "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRO_PRICE_ID:-}" \
  --build-arg "NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID=${NEXT_PUBLIC_STRIPE_CREDITS_100_PRICE_ID:-}" \
  --build-arg "NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=${NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID:-}" \
  --build-arg "NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID=${NEXT_PUBLIC_STRIPE_CREDITS_1500_PRICE_ID:-}" \
  -t "${IMAGE}" \
  --push \
  .
