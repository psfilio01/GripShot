# Grip Shot

> *You hand it your product photos, whisper a few creative ideas, and it comes back with an Amazon-ready lifestyle image that looks like it was shot in a Mediterranean Pilates studio at golden hour. No photographer required — just vibes, rules, and a very opinionated AI.*

Grip Shot is the image generation engine behind **AuréLéa**, a premium Pilates accessories brand. It takes product reference images, brand DNA, creative direction, and non-negotiable guardrails, then assembles a layered prompt and sends it to the Google Gemini image generation API. The result: high-quality lifestyle product images ready for e-commerce listings.

---

## How it works

Grip Shot builds every image prompt from **four layers**, merged in order:

| Layer | Source | Purpose |
|-------|--------|---------|
| **1. Defaults** | Hardcoded values + `data/brand/aurelea/dna.md` | Base visual style (AuréLéa identity), default outfit, barefoot, mat |
| **2. Runtime JSON** | `runtime/run_input.json` | Per-run creative direction from OpenClaw (pose, gaze, outfit, mood, etc.) |
| **3. Global hard rules** | `data/brand/aurelea/hard-rules.md` | Non-negotiable brand guardrails enforced in every image |
| **4. Product hard rules** | `data/products/<id>/hard-rules.md` | Product-specific constraints (visibility, accuracy, context) |

**The mental model:** defaults provide the base, runtime JSON adds creative flair, hard rules enforce what must never be violated. They are **additive**, not mutually exclusive.

---

## Project structure

```
.
├── data/
│   ├── brand/aurelea/
│   │   ├── dna.md                  # AuréLéa brand DNA (visual style guide)
│   │   ├── hard-rules.md           # Global hard rules (non-negotiable)
│   │   └── backgrounds/            # Background reference images (e.g. golden.jpg)
│   ├── models/<modelId>/reference/ # Human model reference images
│   ├── products/<productId>/
│   │   ├── reference/              # Product reference images (multiple angles)
│   │   ├── brand/brand-rules.json  # Legacy brand rules (brand name, etc.)
│   │   └── hard-rules.md           # Product-specific hard rules
│   └── generated/                  # Output: generated images sorted by product/job
├── runtime/
│   ├── run_input.json              # Runtime creative input (written by OpenClaw)
│   └── run_input.example.json      # Example file showing all available fields
├── packages/workflow-core/         # Core TypeScript application
│   └── src/
│       ├── api/workflowFacade.ts   # Main entry point (startImageJob, getJob, handleFeedback)
│       ├── services/
│       │   ├── promptBuilder.ts    # Layered prompt assembly
│       │   ├── imageGenerator.ts   # Gemini API integration
│       │   ├── runtimeInputLoader.ts   # Loads runtime/run_input.json
│       │   ├── hardRulesLoader.ts      # Loads global + product hard rules
│       │   ├── brandDnaLoader.ts       # Loads brand DNA markdown
│       │   ├── modelLoader.ts          # Lists and loads human model references
│       │   ├── backgroundLoader.ts     # Loads background reference images
│       │   └── ...
│       ├── domain/                 # Domain types (Product, Prompt, ImageJob, etc.)
│       ├── types/api.ts            # Public API types
│       └── config/env.ts           # Environment variable schema
├── test-start-job.ts               # Quick test script
├── .env                            # Environment configuration
└── README.md                       # This file
```

---

## Running the script

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
pnpm install
```

### Configure `.env`

```bash
WORKFLOW_DATA_ROOT=/path/to/data
NANOBANANA_API_KEY=your-gemini-api-key
NANOBANANA_MODEL=gemini-3.1-flash-image-preview   # or gemini-3-pro-image-preview
NANOBANANA_DRY_RUN=false                           # true = skip API, use reference image
```

### Run

```bash
pnpm exec ts-node test-start-job.ts
```

By default this runs an `AMAZON_LIFESTYLE_SHOT` for `pilates-mini-ball`. Set `WORKFLOW_TYPE=NEUTRAL_PRODUCT_SHOT` for a plain product shot.

---

## Runtime JSON (`runtime/run_input.json`)

Before each run, OpenClaw (or you manually) can write a JSON file with creative direction. The file is **optional** — if it doesn't exist, Grip Shot uses its defaults.

### Supported fields

| Field | Example | What it does |
|-------|---------|--------------|
| `pose` | `"seated pilates twist"` | Specific model pose (overrides random pose selection) |
| `gaze` | `"slightly away from camera"` | Model's gaze direction |
| `outfit` | `"minimal beige activewear"` | Overrides default black Pilates outfit |
| `feet_style` | `"barefoot on mat"` | Overrides default barefoot setting |
| `background_style` | `"warm golden studio"` | Overrides default/golden background logic |
| `composition_goal` | `"product centered in frame"` | Composition guidance for the AI |
| `mood` | `"serene, focused"` | Mood/atmosphere hint |
| `framing` | `"full body, eye-level"` | Camera framing guidance |
| `extra` | `"add soft lens flare"` | Any additional prompt hint |

Any field can be omitted. Only present fields are used. See `runtime/run_input.example.json` for a complete example.

### Where OpenClaw writes it

OpenClaw writes `runtime/run_input.json` in the project root (next to `data/`). The loader looks for it at `<project_root>/runtime/run_input.json`.

---

## Product hard rules

Each product can have a `hard-rules.md` file in its product directory:

```
data/products/pilates-mini-ball/hard-rules.md
data/products/grip-socks/hard-rules.md
```

These define **non-negotiable constraints** that are always appended to the prompt. Example:

```markdown
# Pilates Mini Ball – Hard Rules

- The mini ball must always be clearly visible and recognisable in the image.
- The ball's shape must remain round and undistorted.
- The ball's color and texture must accurately match the reference images.
```

### Global hard rules

Brand-wide rules live at `data/brand/aurelea/hard-rules.md` and are enforced in **every** image regardless of product.

---

## Fallback behavior

| What's missing | What happens |
|----------------|--------------|
| No `runtime/run_input.json` | Grip Shot uses built-in defaults (black outfit, barefoot, random pose) |
| No `hard-rules.md` for a product | No product-specific rules appended; global rules still apply |
| No `data/brand/aurelea/hard-rules.md` | No global rules appended; prompt still works |
| No `data/brand/aurelea/dna.md` | Fallback brand DNA text is used inline |
| No model references in `data/models/` | Image generated without a specific model reference |

The system is designed to work with **any combination** of present/absent files. Everything degrades gracefully.

---

## OpenClaw integration (future)

Grip Shot is designed to be triggered by OpenClaw:

1. OpenClaw writes `runtime/run_input.json` with creative direction for the run
2. OpenClaw calls `startImageJob()` with the desired product and workflow type
3. Grip Shot loads all layers, builds the prompt, generates the image
4. OpenClaw reads the result via `getJob()` and sends the preview via WhatsApp
5. User reacts (heart = favorite, thumbs down = reject)
6. OpenClaw calls `handleFeedback()` to move the image to the appropriate folder

The `runtime/run_input.json` file is the handoff point between OpenClaw's planning and Grip Shot's execution.

---

## Supported Gemini models

| Model | ID | Use case |
|-------|----|----------|
| Nano Banana 2 | `gemini-3.1-flash-image-preview` | Fast, high-volume generation |
| Nano Banana Pro | `gemini-3-pro-image-preview` | Higher quality, professional assets |

Set `NANOBANANA_MODEL` in `.env` to switch between them.

---

## Programmatic API

```typescript
import { startImageJob, getJob, handleFeedback } from "@fashionmentum/workflow-core";

const { jobId } = await startImageJob({
  productId: "pilates-mini-ball",
  workflowType: "AMAZON_LIFESTYLE_SHOT",
  useGoldenBackground: true,
});

const job = await getJob(jobId);

await handleFeedback({ imageId: "<id>", action: "favorite" });
```
