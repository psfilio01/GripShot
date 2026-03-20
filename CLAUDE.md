# Grip Shot / Amazon Seller SaaS

## Mission
Extend the existing repository into a production ready SaaS for Amazon sellers.
Build on the current monorepo and workflow engine. Do not rewrite the project from scratch unless a component is clearly unsalvageable and the replacement is fully justified in the commit message and README updates.

The product goal is a fun, slightly weird, high utility web app for Amazon sellers aged roughly 20 to 35 that helps them:
1. onboard their brand and products
2. generate Amazon compliant listing copy
3. generate product and model based images with Gemini
4. generate A Plus content assets
5. manage generation results in a searchable dashboard
6. pay via subscriptions and buy extra credits
7. optionally trigger jobs through WhatsApp or Telegram later

## Non negotiable working style
1. Work feature by feature.
2. Every completed feature must include code, tests, docs, and a concise README update.
3. Always prefer the smallest useful slice that leaves the app runnable.
4. Before coding, inspect the existing implementation and extend it instead of replacing it.
5. If requirements are ambiguous, choose the most commercially sensible and technically robust path.
6. Always consult official documentation for external services and follow current best practices.
7. Keep local development and Cloud Run deployment working in parallel.
8. Keep the app stateless. User files and generated assets must go to managed storage, not durable local container storage.
9. Default branch is `main`. If the repository uses another primary branch, detect it and adapt.

## Mandatory architecture direction
Use this target stack unless a documented reason requires a different choice:
- Monorepo with pnpm
- TypeScript end to end
- Next.js App Router for the web app
- Existing `packages/workflow-core` remains the image generation domain package and is expanded, not discarded
- Cloud Run for deployment of the app container
- Firebase Authentication for auth
- Cloud Storage for Firebase or Google Cloud Storage for uploads and generated assets
- Firestore for app metadata, jobs, user projects, quotas, and dashboard indexing unless a stronger reason favors PostgreSQL
- Stripe Billing for subscriptions, usage top ups, and webhook driven account state updates
- Playwright for end to end tests
- Vitest for unit and integration tests
- Gemini models via official Google APIs only

## Product scope to preserve and expand
Current repository already contains:
- a Node/TypeScript monorepo
- `packages/workflow-core` with prompt building, model references, storage, metadata handling, and Gemini image generation
- local data folders for products, models, brand DNA, and generated outputs
- no real web UI yet

Keep the current workflow engine as the core generation package and evolve around it.

## Domain requirements
### 1. Auth and accounts
- Support email/password and Google sign in first.
- Keep social auth provider design extensible.
- Every authenticated user belongs to an account/workspace.
- Prepare for subscriptions and monthly quotas from the beginning.

### 2. Onboarding
Build a guided onboarding flow that captures:
- brand name
- whether it is a private label brand
- brand DNA
- target audience
- product category
- tone and conversion priorities
- Amazon marketplace assumptions

The onboarding should feed both listing copy generation and image generation defaults.

### 3. Listing copy generation
The user must be able to generate:
- product title
- bullet points
- product description

Requirements:
- optimize for conversion and Amazon compliance
- reflect brand DNA and product specifics
- use structured inputs first, then optional free text
- support bundle products and product variants
- save all inputs and outputs for editing and reuse

### 4. Model generation setup
Users should be able to define model preferences through structured UI and optional free text.
Support fields such as:
- gender presentation
- age range
- activity level
- body type
- style notes
- optional accessories or jewelry

Default behavior:
- neutral clothing
- no distracting accessories
- focus on face, posture, and brand fit unless user overrides it

### 5. Product reference ingestion
Design the product intake model so the user can upload and categorize:
- primary product references
- logo close ups
- packaging references
- angle specific product references
- sole or underside references when relevant
- bundle members and bundle metadata
- optional color variants as files or hex codes

The system must understand structured relationships such as:
- product A, B, C within a bundle
- which image belongs to which bundle member
- which images are logos vs full product shots
- which color variants are real uploaded references vs inferred from hex values

### 6. Generation outputs
Support at minimum these output categories:
- listing images
- neutral product shots
- lifestyle product images
- A Plus content images
- A Plus text suggestions

The attached screenshots show multiple A Plus module patterns. Build the system so templates are data driven and expandable, not hardcoded to one layout.

### 7. Dashboard
Users need a dashboard where they can:
- browse generated results
- filter by product, model, output type, and time
- favorite, reject, archive, and compare outputs
- trace each asset back to its source inputs

### 8. Messaging integration
Prepare the backend abstraction for future WhatsApp and Telegram control.
Do not block core SaaS launch on this, but design jobs and notifications so a messaging channel can trigger a generation job and later sync previews back into the dashboard.

### 9. Billing and quotas
Implement quota logic from the beginning.
Rules:
- monthly quota per subscription tier
- generation stops when quota is exhausted
- users can buy extra credits
- nothing already generated is lost when quota is exhausted
- webhook events from Stripe are the source of truth for billing state

## Engineering rules
### Quality gates for every feature
A feature is only complete if all of the following are true:
1. relevant unit tests pass
2. relevant integration tests pass
3. relevant Playwright tests pass when UI is affected
4. lint and typecheck pass
5. local run still works
6. docs are updated
7. README is updated in plain language
8. deployment instructions remain valid

### Documentation rules
After every completed feature:
- update the main `README.md` with a short user facing summary
- update `docs/LOCAL_DEV_AND_DEPLOY.md` if setup or deployment changed
- update or add the smallest technical note needed for future maintainers

Documentation should be simple, precise, and current. Do not dump large autogenerated prose.

### Git workflow
For each feature:
1. create a short lived feature branch
2. implement the feature
3. run tests and validations
4. commit with a focused message
5. push the branch
6. if all checks pass, merge into the primary branch
7. delete the feature branch if appropriate

Never merge failing code.
Never bypass tests unless the repo is broken before the feature started, in which case document the pre existing failure explicitly.

### Research rules
For external services, libraries, or APIs:
- check official documentation first
- prefer stable GA features over preview features unless preview is essential
- document any preview dependency clearly
- avoid outdated blog patterns when official docs provide a better path

## Autonomy rules
You are allowed and expected to:
- propose small, high value features not explicitly requested
- improve UX, DX, security, observability, and reliability where sensible
- add missing validations, schemas, and migration paths
- improve naming and folder structure incrementally

You are not allowed to:
- replace the stack with unrelated technologies without strong justification
- create giant speculative systems before the thin vertical slice works
- silently delete existing behavior that may matter
- introduce fake implementations without labeling them clearly

## Preferred delivery order
Unless current code state forces a different order, prioritize like this:
1. repository analysis and gap report
2. local app shell and Next.js UI foundation
3. Firebase auth and protected app routes
4. Firestore and storage data model
5. onboarding flow
6. listing copy generation flow
7. product reference upload and categorization
8. generation job orchestration in the web app
9. results dashboard
10. Stripe subscription and quota enforcement
11. A Plus content workflows
12. optional messaging integration foundation

## Test strategy expectations
- Unit tests for pure logic and validators
- Integration tests for service boundaries and data flow
- Playwright tests for onboarding, auth, uploads, generation flows, and dashboard interactions
- Mock external APIs where practical
- Keep at least one narrow happy path that can run locally without paid external services

## Dependency Policy
- Only install well-known, actively maintained packages with a strong community
- Prefer packages with >1000 weekly downloads and recent updates (<6 months)
- Minimize the number of dependencies — use existing libraries or native solutions first
- Pin exact versions in package.json (no ^ or ~)
- Never install packages that look like typosquatting variants
- When in doubt, ask before adding a new dependency

## Definition of success for this project
Deliver a polished SaaS that can be run locally and deployed to Google Cloud Run, with Firebase based auth and storage, Stripe based billing, a strong Amazon seller workflow, a playful but professional UI, and a maintainable engineering foundation.
