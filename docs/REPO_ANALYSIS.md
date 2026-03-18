# Current Repository Analysis

## What exists today
The uploaded repository is a Node.js and TypeScript pnpm monorepo called `fashionmentum-image-workflow`.

Current strengths:
- clear monorepo base with `packages/workflow-core`
- existing Gemini image generation integration
- layered prompt construction already exists
- product, brand DNA, hard rules, and model references already exist as local file based inputs
- image jobs, metadata, and feedback handling already exist in the core package
- local sample runtime inputs already exist

Key files already present:
- `packages/workflow-core/src/api/workflowFacade.ts`
- `packages/workflow-core/src/services/imageGenerator.ts`
- `packages/workflow-core/src/services/promptBuilder.ts`
- `data/brand/*`
- `data/products/*`
- `data/models/*`
- `runtime/run_input.json`

## What is missing
The current codebase does not yet provide the SaaS shell required for commercial launch.

Missing or incomplete areas:
- no actual web UI
- no auth
- no persistent cloud data model for customers and workspaces
- no upload flow for end users
- no billing or quotas
- no dashboard
- no A Plus module management UI
- no messaging channel integration
- no Cloud Run oriented app container setup for the full product
- no end to end Playwright suite for a web app

## Recommended interpretation
Treat the current repository as the generation engine, not as the final application.
The right move is to preserve and expand the existing `workflow-core` package while adding a new app layer around it.

## Recommended target structure
```text
.
├── apps/
│   └── web/                    # Next.js SaaS app
├── packages/
│   ├── workflow-core/          # existing generation engine, expanded
│   ├── ui/                     # shared UI components if needed later
│   ├── config/                 # shared tsconfig, eslint, env helpers
│   └── domain/                 # shared types/schemas if needed later
├── docs/
├── infra/
│   ├── docker/
│   └── gcp/
└── .claude/
```

## Migration principle
Do not rewrite the existing engine just because the product now needs a UI.
Instead:
1. isolate reusable domain logic in `workflow-core`
2. add a new `apps/web` project
3. gradually move file based assumptions behind storage adapters
4. preserve local mode for development and tests
5. add cloud adapters for Firebase Storage, Firestore, and production job handling

## A Plus insight from the screenshots
The screenshots indicate the app should support a library of A Plus module patterns such as:
- single image plus text left or right
- technical specifications tables
- multiple image grids
- image header with text
- comparison charts
- branded logo panels

This should become a template system with:
- template metadata
- layout schema
- required asset slots
- recommended image dimensions
- optional AI ready badge or guidance copy

Do not hardcode the exact screenshot set into the UI. Model it as a template catalog that can expand later.
