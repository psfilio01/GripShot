#!/usr/bin/env bash
# Load Firebase Admin credentials from repo .env / packages/web/.env.local and backfill
# deletedAt/deletedBy on workspace subcollections (humanModels, products, backgrounds, workflows).
#
# Usage (from repo root):
#   ./scripts/backfill-soft-delete-fields.sh                    # apply changes
#   ./scripts/backfill-soft-delete-fields.sh --dry-run          # summary only
#   ./scripts/backfill-soft-delete-fields.sh --dry-run --verbose # log each doc
#   ./scripts/backfill-soft-delete-fields.sh --workspace=<id> [--dry-run] [--verbose]
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/packages/web"
exec node "${ROOT}/scripts/backfill-firestore-soft-delete-fields.mjs" "$@"
