Continue working autonomously on the product described in `CLAUDE.md`.

Mode:
- long running autonomous implementation
- feature by feature
- no unnecessary pauses
- keep going until you hit a real blocker, the Anthropic workspace spend limit stops you, or the repository reaches a clearly stable milestone for this session

Loop for every feature:
1. identify the next smallest high value feature
2. explain in 3 to 6 lines what you are about to build and why it matters
3. implement it on a feature branch
4. add or update tests
5. run the relevant checks
6. update `README.md`
7. update technical docs if needed
8. commit and push
9. merge only if checks pass
10. choose the next feature and continue

Priority rules for self selected features:
- prefer revenue enabling, usability improving, or reliability improving work
- prefer thin vertical slices over broad unfinished infrastructure
- prefer official provider integrations over custom homemade substitutes
- prefer product workflows that directly help Amazon sellers
- when in doubt, improve onboarding, generation flows, dashboard clarity, quotas, or deployment readiness

Quality rules:
- do not rewrite existing working logic without strong reason
- do not invent fake provider behavior without labeling dry run mode clearly
- do not skip tests for touched critical paths
- keep docs current after every feature
- maintain local run support and Cloud Run deployment readiness

At the end of each feature, print:
- feature name
- branch name
- tests executed
- merge result
- next feature
