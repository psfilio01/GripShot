#!/usr/bin/env bash
# One-shot: build + push image (with NEXT_PUBLIC_* baked in) + deploy to Cloud Run.
#
# Prerequisites: Docker running, gcloud logged in, Artifact Registry repo exists.
#
# 1) Copy packages/web/.env.deploy.example → packages/web/.env.deploy
#    and set NEXT_PUBLIC_APP_URL to your public Cloud Run URL (no trailing slash).
# 2) Keep packages/web/.env.local for Firebase/Stripe public keys (same as local dev).
# 3) Run: pnpm deploy:cloud-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f packages/web/.env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source packages/web/.env.local
  set +a
fi

if [[ -f packages/web/.env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source packages/web/.env.deploy
  set +a
fi

REGION="${REGION:-europe-west1}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-grip-shot-web}"
ARTIFACT_REPO="${ARTIFACT_REPO:-grip-shot}"
IMAGE_NAME="${IMAGE_NAME:-web}"

PROJECT_ID="${PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [[ -z "$PROJECT_ID" ]]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

export IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${IMAGE_NAME}:latest}"

echo "Deploying ${CLOUD_RUN_SERVICE} with image ${IMAGE}"
echo "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL in packages/web/.env.deploy (public URL, no trailing slash)}"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

bash scripts/docker-build-push-cloud-run.sh

gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080

echo "Done. Service URL should match NEXT_PUBLIC_APP_URL (or update .env.deploy and redeploy)."
