# Test Strategy

## Objective
Every meaningful feature must prove correctness at the lowest sensible level and at the end user level when UI is affected.

## Layers
### Unit tests with Vitest
Use for:
- prompt assembly logic
- validators and schemas
- quota calculations
- bundle and asset categorization rules
- A Plus template selection and slot mapping
- text transformation helpers

### Integration tests with Vitest
Use for:
- workflow core plus adapters
- Firestore repositories with emulator or test doubles
- Storage adapter behavior
- Stripe webhook processing
- auth guards and server side actions
- job orchestration boundaries

### End to end tests with Playwright
Use for:
- signup and login
- onboarding flow
- product creation
- file uploads
- listing copy generation
- image generation request flow in dry run mode
- dashboard filtering and result inspection
- billing and quota UX where possible in test mode

## Local dry run requirement
Maintain at least one dry run path for the full happy path so the app can be tested without paid provider calls.
This mode should:
- avoid real Gemini costs
- generate placeholder or copied outputs deterministically enough for tests
- still exercise the orchestration pipeline

## Required checks before merge
- lint
- typecheck
- unit tests
- integration tests
- Playwright tests affected by the feature
- smoke run for local app or targeted workflow

## Minimum first Playwright scenarios
1. user can sign up and complete onboarding
2. user can create a product and upload at least one reference image
3. user can generate listing copy in dry run mode
4. user can trigger an image generation job in dry run mode
5. user can view outputs in the dashboard

## Testing philosophy
- mock expensive providers at the boundary
- keep pure logic isolated and easy to test
- avoid brittle visual assertions unless they protect critical UX
- prefer deterministic fixtures for upload and generation tests
