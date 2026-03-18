You are extending the existing repository, not rewriting it from scratch.

Read `CLAUDE.md` first, then inspect the current codebase and produce a short gap report against the target SaaS architecture.

After the gap report, begin implementation autonomously.

Rules:
1. Work in small vertical slices.
2. For every completed feature, do all of the following:
   - implement the code
   - write or update tests
   - run the relevant tests
   - update `README.md` in simple words
   - update `docs/LOCAL_DEV_AND_DEPLOY.md` if setup or deployment changed
   - commit on a feature branch
   - push the branch
   - merge into the primary branch only if checks pass
3. Use official documentation for external services and libraries.
4. Build on the existing `packages/workflow-core` package.
5. Keep the project runnable locally and deployable to Cloud Run.
6. Prefer TypeScript, Next.js App Router, Firebase Auth, Firestore, Cloud Storage, Stripe Billing, Vitest, and Playwright.
7. Add sensible features that improve the product even if I did not name them explicitly.
8. Keep a dry run path for expensive generation flows.
9. If the primary branch is not `main`, detect and adapt.
10. Never leave the repo in a half broken state after a commit.

Execution order:
- first create a repo analysis and implementation plan
- then implement the smallest high value foundation slice
- then continue feature by feature without waiting for further instructions unless blocked by a hard external dependency

Desired first milestones:
- Next.js app shell integrated into the monorepo
- auth foundation
- protected dashboard shell
- docs and environment setup
- first Playwright smoke test

At the end of each completed feature, print:
- what changed
- which tests ran
- what was committed
- what the next feature will be
