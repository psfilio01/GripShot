# Grip Shot — Project Rules

## Stack
Monorepo (pnpm), TypeScript, Next.js App Router, Firebase Auth, Firestore,
Cloud Storage, Stripe Billing, Gemini API, Telegram Bot API, Vitest, Playwright.
`packages/workflow-core` = image generation engine. Extend, never replace.

## Working Rules
1. Work feature-by-feature in small vertical slices
2. Inspect existing code before writing new code — extend, don't rewrite
3. Every feature = code + tests + docs + README update
4. Keep app runnable locally AND deployable to Cloud Run
5. Stateless app — user files go to managed storage
6. Commit on feature branches, merge only when tests pass
7. Commit messages: "Cloude: <msg>"
8. If ambiguous, choose the commercially sensible path
9. Keep a dry-run path for all expensive API calls (Gemini, Telegram in dev)
10. Always check official docs before making SDK/platform decisions

## Quality Gates
Feature is done when: unit tests pass, integration tests pass,
Playwright tests pass (if UI), lint + typecheck pass, local run works,
docs updated, README updated, deploy instructions still valid.

## Architecture Notes
- Firebase Auth: email/password + Google sign-in
- Every user belongs to a workspace with subscription + quota
- Stripe webhooks = source of truth for billing state
- Generation stops at quota limit, nothing already generated is lost
- Telegram Bot: full-featured messaging interface (webhook-based, same API as web)
  - Workflow CRUD, generation, feedback, model/background/product management
  - Voice messages via Gemini Flash transcription
  - Sequential multi-step selection flows (model → background → language → confirm)
  - Deep-links to web dashboard for image-heavy views
  - Bilingual bot messages (DE/EN) via bot-messages.ts, user's preferredLocale
  - Commands: /start, /status, /help, /dashboard, /settings, /workflows, /newworkflow,
    /products, /models, /backgrounds, /newmodel, /newbackground, /newproduct, /cancel
  - Resource list commands with deep-link buttons to web dashboard
  - /status shows plan, credits, and resource counts (products, models, backgrounds)
  - /workflows shows step progress per workflow (done/total)
  - /newworkflow prompts for description, then enters sequential settings flow
  - Resource creation flows match web form fields (AI model attrs, background types, product categories)
  - Post-generation navigation: [Next] [All remaining] [Back to overview]
  - Conversation state in Firestore (users/{uid}/telegramState/current)
  - Intent classifier: create_workflow, create_model, create_background, create_product, question, feedback
- Custom Workflows: user-defined multi-step generation jobs with Hero Lock color variants
  - Workflow steps with completed images can generate color variants via Hero Lock
  - Color variants stored as `colorVariants[]` on workflow step docs
  - API: POST /api/workflows/{id}/steps/{index}/hero-lock
  - Quota-enforced: each color variant consumes 1 credit
  - Bundle download includes color variants in `step-NN-title/colors/` subfolder
  - Telegram bot offers [🎨 Farben generieren] button after step image generation
- Real-ESRGAN 4K Upscale: cost-free local upscaling of generated images
  - Default generation resolution: 1K (cost-optimized), user can override to 512/2K/4K
  - Upscale via real-esrgan-ncnn-vulkan binary (no Python, ~60MB)
  - Service: `packages/workflow-core/src/services/imageUpscaler.ts`
  - API: POST /api/workflows/{id}/steps/{index}/upscale (single step)
  - API: POST /api/workflows/{id}/batch-upscale (all eligible steps)
  - Upscale = 0 credits (free, no API call — local binary only)
  - Dry-run mode: copies input as-is when NANOBANANA_DRY_RUN=true
  - Graceful degradation: logs warning if binary missing, upscale buttons hidden
  - Dockerfile bundles binary + models in /app/bin/realesrgan/
  - Local setup: `scripts/setup-realesrgan.sh` (vendor/realesrgan-ncnn-vulkan/)
  - Upscaled path stored as `upscaledImagePath` on WorkflowStepDoc
  - Bundle download includes 4K versions as `original-4k.png`
  - Telegram: [⬆ 4K] button after image generation, sends upscaled as new photo
  - UI: [4K Upscale] button per step + [All to 4K] batch button in workflow header
- Soft-delete with 7-day trash (Cloud Storage lifecycle rules for auto-purge)
- All actions sync between web dashboard and Telegram in real-time

## Dependencies
- Only well-known, actively maintained packages (>1k weekly downloads)
- Pin exact versions (no ^ or ~)
- Ask before adding new dependencies

## Autonomy
DO: propose small improvements, add validations, improve naming.
DON'T: replace stack without justification, build speculative systems,
silently delete existing behavior, introduce fakes without labeling them.