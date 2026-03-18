# Product and Architecture Blueprint

## Product thesis
Build a SaaS for Amazon sellers that combines listing copy generation, product reference management, AI image generation, A Plus content generation, and output management in one workflow.

Primary audience:
- younger e commerce operators
- Amazon first sellers
- private label brands
- design conscious but conversion focused users

## UX principles
- playful and slightly weird, but still credible
- high signal, low confusion
- guided forms over blank pages
- structured inputs first, free text second
- every generated asset should be traceable to its source inputs
- every expensive action should expose quota impact before running

## Technical architecture
### Frontend
- Next.js App Router
- TypeScript
- Server Components where they simplify data loading
- client components only where interactivity is needed
- clean dashboard oriented information architecture

### Backend execution model
- initial deployment as a single web application container on Cloud Run
- route handlers and server actions for app flows
- background job abstraction introduced early so long running generations can later move to separate worker services if needed

### Data and storage
- Firebase Authentication for user identities
- Firestore for users, workspaces, products, models, jobs, outputs, quotas, subscriptions, and template metadata
- Cloud Storage for user uploads and generated assets
- existing local file based mode retained for local development and tests

### Billing
- Stripe Billing for subscriptions
- Stripe webhooks for authoritative state updates
- monthly quota ledger in Firestore
- extra credit purchases supported as top ups

### AI and generation
- existing `workflow-core` package remains the domain engine
- Google Gemini APIs via official SDKs or official REST interfaces only
- image generation and text generation both abstracted behind provider adapters
- model and output metadata recorded for auditability

## Suggested domain model
### Core entities
- User
- Workspace
- Subscription
- QuotaLedger
- Product
- ProductAsset
- ProductVariant
- Bundle
- BrandProfile
- ModelProfile
- GenerationJob
- GenerationOutput
- APlusTemplate
- APlusProject

### Example product asset categories
- product_full
- product_angle_left
- product_angle_right
- product_top
- product_bottom
- product_sole
- logo_closeup
- packaging
- bundle_member
- lifestyle_reference

### Example generation types
- listing_copy
- neutral_product_image
- lifestyle_image
- aplus_image
- aplus_copy

## Commercial readiness requirements
- multi tenant safe data access
- webhook idempotency
- usage accounting per generation event
- storage path conventions by workspace and product
- audit trail for generated assets and source prompts
- legal visibility into what was generated, when, and with which inputs

## Deployment recommendation
### Production
- Cloud Run for the main app container
- Firebase Hosting in front if you want first class frontend hosting and routing to Cloud Run
- Firestore and Cloud Storage in the same Google project
- Stripe webhook endpoint exposed through the app

### Local development
- Docker for consistent runtime
- local `.env` based setup
- Firebase emulators when feasible
- mocked generation mode for faster tests

## Phased implementation plan
### Phase 1
- repo cleanup
- Next.js app scaffold
- auth foundation
- protected dashboard shell
- local and Docker dev flow

### Phase 2
- onboarding flow
- brand profile persistence
- product creation and upload flow
- listing copy generation

### Phase 3
- generation job orchestration
- results dashboard
- Playwright coverage

### Phase 4
- Stripe subscriptions
- quota enforcement
- A Plus content template system

### Phase 5
- messaging integration abstraction
- WhatsApp or Telegram proof of concept
- admin analytics and operational tooling
