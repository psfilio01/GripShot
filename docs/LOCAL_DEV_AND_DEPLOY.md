# Local Development and Deployment

## Local development goals
The project must always support two modes:
1. local developer mode for fast iteration and testing
2. production mode for Cloud Run deployment

## Recommended local stack
- Node.js LTS
- pnpm
- Docker
- Firebase project for auth and storage
- Firebase emulators where practical
- Playwright browsers installed locally or in CI

## Environment variable groups
### App and auth
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Gemini
- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`
- `GEMINI_IMAGE_MODEL_FAST`
- `GEMINI_IMAGE_MODEL_PRO`
- `GEMINI_DRY_RUN`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_CREDIT_TOPUP`

### Storage and app URLs
- `APP_BASE_URL`
- `PUBLIC_ASSET_BASE_URL`
- `WORKFLOW_DATA_ROOT`

## Docker guidance
Containerize the app from the start, but do not assume Docker alone solves auth, storage, billing, or domains.
Use Docker to ensure runtime parity and easier deployment to Cloud Run.

Recommended direction:
- one app container for the Next.js app
- external managed services for auth, storage, billing, and databases
- no durable user state stored on the container filesystem

## Cloud Run deployment guidance
### Keep the app stateless
All durable data must live outside the container:
- Firestore for metadata
- Cloud Storage for files
- Stripe for billing records
- Firebase Auth for identity

### Domain routing
You can map a custom domain to a Cloud Run service, or place Firebase Hosting in front and route dynamic requests to Cloud Run. Choose the simpler path that fits the final routing model.

### Build pipeline
Recommended CI path:
1. install dependencies
2. run lint, typecheck, unit tests, integration tests, Playwright smoke tests
3. build the app container
4. deploy to Cloud Run
5. run post deployment smoke checks

## Local run contract
At minimum the repo should support commands equivalent to:
- install dependencies
- start local web app
- run unit tests
- run integration tests
- run Playwright tests
- run a dry run generation flow without paid APIs

## Production safety requirements
- validate all webhook signatures
- use idempotency keys where supported
- keep secrets in environment variables or secret management
- never expose server secrets to the client
- log job identifiers and provider response metadata
- redact sensitive tokens from logs
