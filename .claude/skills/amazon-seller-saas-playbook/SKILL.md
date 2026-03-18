---
name: amazon-seller-saas-playbook
description: Playbook for building and evolving the Amazon seller SaaS on top of the existing repository with autonomous feature delivery, testing, documentation, and deployment readiness.
---

# Amazon Seller SaaS Playbook

## Purpose

This skill helps Claude Code work effectively on this project.

The project goal is to extend the existing repository into a production ready SaaS for Amazon sellers. The product should support listing text generation, product and model generation workflows, A plus content support, dashboard management, quota and billing logic, and later messaging based workflows such as WhatsApp or Telegram. The product should be fun, slightly weird in tone and presentation, but still accurate, useful, and commercially strong.

## Non negotiable rules

- Extend the existing repository
- Do not replace the whole architecture without hard evidence
- Prefer small vertical slices
- Every completed feature must include tests where appropriate
- Every completed feature must update documentation
- Local development must keep working
- Production target is Docker plus Google Cloud Run
- Prefer Firebase Auth for authentication
- Prefer Firebase Storage or Google Cloud Storage for uploads and generated assets
- Prefer Stripe for subscriptions, quotas, and top ups
- Prefer official Gemini APIs and official documentation
- Prefer JavaScript or TypeScript native tooling
- Use Playwright for browser level UI testing
- Use official docs and best practices before making important platform decisions

## Working style

For every new feature:
1. Understand the current repo state
2. Decide whether the feature already partially exists
3. Implement the smallest useful version
4. Add or update tests
5. Run validation
6. Update user facing documentation
7. Update technical run and deploy documentation
8. Commit changes on a feature branch
9. Only merge after success criteria are met

## Success criteria for a feature

A feature is only complete when all relevant conditions are true:

- The implementation builds
- Relevant tests pass
- The feature works locally
- Documentation is updated
- The change is committed with a clear message
- If safe and configured, the branch can be merged after validation

## Repository extension strategy

Assume there is already useful code in place, especially around workflow logic, prompt building, generation flows, or data models.

Always prefer:
- reusing existing modules
- extracting shared logic cleanly
- layering SaaS capabilities around the core
- preserving existing value

Avoid:
- unnecessary rewrites
- introducing duplicate abstractions
- swapping frameworks without a strong reason

## Product priorities

Prioritize work in roughly this order unless the repo state strongly suggests otherwise:

1. Repository understanding and architecture alignment
2. Minimal but strong UI foundation
3. Auth and session handling
4. Product onboarding flows
5. Listing text generation
6. Product and model asset workflows
7. Upload structure and media management
8. Dashboard and history browsing
9. Quota and subscription logic
10. A plus content workflows
11. Messaging integrations such as WhatsApp or Telegram
12. Nice to have enhancements

## UX principles

- Make the app enjoyable to use
- Keep the interface understandable for non technical Amazon sellers
- Prefer guided flows over confusing control panels
- Allow optional advanced settings
- Keep generated outputs well organized by product, model, time, and category
- Support weird and fun personality in moderation, without reducing trust

## AI and generation principles

- Brand DNA must influence output
- Conversion matters
- Amazon compliance matters
- Generated listing text should fit Amazon style expectations
- Generated visuals should respect product identity, variants, and user supplied references
- Support optional model guidance and optional automation
- Treat logos, packaging, bundle parts, variant colors, and angle references as distinct useful categories

## Required docs discipline

After each completed feature:
- update README.md in simple language
- update technical docs for local execution if needed
- update deploy notes if deployment changes
- keep docs concise but clear

## Testing expectations

Prefer a layered strategy:
- unit tests for isolated logic
- integration tests for feature contracts
- Playwright tests for important user journeys

Critical flows should eventually include:
- sign up and sign in
- onboarding
- listing generation
- upload flows
- dashboard browsing
- quota enforcement
- billing related state changes

## Research expectations

Before major platform or SDK choices:
- check official documentation
- prefer first party guidance
- note caveats for local versus production use
- avoid relying on stale assumptions

## Commit and merge policy

- use feature branches
- keep commits focused
- write clear commit messages
- do not merge broken work
- merge only after validation succeeds
- if merge automation exists, use it carefully

## Budget awareness

The project should assume a hard external spend stop exists for Claude usage.

Do not rely on repository code alone to stop model spend. Prefer external account or workspace spend controls. Within the repo, cost tracking and usage visibility can still be added as product features.

## When in doubt

If requirements are incomplete:
- choose the most practical option
- document the decision
- keep the solution extensible
- do not block on minor ambiguity
- move forward with best practice defaults