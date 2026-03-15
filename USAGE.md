# FashionMentum Image Workflow – Usage

## Running the workflow locally

From the repo root:

```bash
pnpm install
pnpm exec ts-node test-start-job.ts
```

Ensure a `.env` file exists (see below). The script starts an image job for `pilates-mini-ball` and prints the job result and full job details.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKFLOW_DATA_ROOT` | No (default: `./data`) | Absolute path to the data directory (products, reference images, brand rules, output). |
| `NANOBANANA_API_KEY` | Yes (unless dry-run) | Google Gemini API key. Passed only as `?key=` query parameter (never in headers). Get one at [Google AI Studio](https://aistudio.google.com/apikey). |
| `NANOBANANA_BASE_URL` | No | Gemini API base URL (default: `https://generativelanguage.googleapis.com/v1beta`). |
| `NANOBANANA_MODEL` | No | Gemini model name (default: `gemini-2.0-flash`). For image generation use an image-capable model as in [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation). |
| `NANOBANANA_DRY_RUN` | No | Set to `true` or `1` to skip the real API and use the reference image as output (for testing when the API is unreachable). |

## If you see `ENOTFOUND` or 404 for the API

- Ensure `NANOBANANA_BASE_URL` is `https://generativelanguage.googleapis.com/v1beta` (the code appends `/models/{model}:generateContent`).
- Ensure your Gemini API key is set in `.env` as `NANOBANANA_API_KEY`; it is sent only as `?key=...`, not in an `Authorization` header.
- To test the rest of the pipeline **without** calling the API, set in `.env`:
  ```bash
  NANOBANANA_DRY_RUN=true
  ```
  The job will then “generate” by copying the first reference image into the neutral output folder so you can verify folders, metadata, and `getJob` behaviour.

## Data folder structure

- **Products:** `data/products/<productId>/reference/` — place one or more product reference images (e.g. Pilates mini ball from different angles). The job randomly uses 1 to 3 of them for lifestyle shots.
- **Brand DNA:** `data/brand/aurelea/dna.md` — AuréLéa brand DNA text used in lifestyle prompts (minimal, calm, premium, etc.).
- **Golden background:** `data/brand/aurelea/backgrounds/golden.jpg` (or `.png`) — optional. Used when `useGoldenBackground: true` for `AMAZON_LIFESTYLE_SHOT`.
- **Models (people):** `data/models/<modelId>/reference/` — reference images for the person/model. If you pass `modelId` the job uses that model; otherwise a random one is chosen. Omit or leave empty to generate without a specific model reference.

## Workflow types and job options

- **NEUTRAL_PRODUCT_SHOT** — One product reference, neutral e‑commerce shot.
- **AMAZON_LIFESTYLE_SHOT** — Lifestyle product image: model + product in use (e.g. Pilates exercise), AuréLéa style. Options:
  - `modelId` — use this model’s references; if omitted, a random model from `data/models/` is chosen (or none if no models exist).
  - `useGoldenBackground` — use the golden background reference image from `data/brand/aurelea/backgrounds/`.
  - `sceneOptions` — override defaults: `outfit`, `barefoot`, `mat` (defaults: short black Pilates outfit, barefoot, black mat).
  - `creativeFreedom` — allow the AI to adapt styling within brand DNA.

## Programmatic API (for OpenClaw)

```ts
import { startImageJob, getJob, handleFeedback } from "@fashionmentum/workflow-core";

// Neutral product shot (existing)
const { jobId, status } = await startImageJob({
  productId: "pilates-mini-ball",
  workflowType: "NEUTRAL_PRODUCT_SHOT",
});

// Amazon-style lifestyle shot (AuréLéa)
const { jobId: jobId2 } = await startImageJob({
  productId: "pilates-mini-ball",
  workflowType: "AMAZON_LIFESTYLE_SHOT",
  useGoldenBackground: true,
  sceneOptions: { outfit: "short Pilates outfit in neutral black", barefoot: true, mat: "black exercise mat" },
  // modelId: "model-1",  // optional; omit to pick a random model
  // creativeFreedom: true,
});

// Get job and image variants
const job = await getJob(jobId);

// Handle feedback (e.g. from WhatsApp)
await handleFeedback({
  imageId: "<variant-id>",
  action: "favorite", // or "reject" | "generate_all_colors"
});
```

When running from the monorepo root without building the package, you can import from the source instead:

```ts
import { startImageJob, getJob, handleFeedback } from "./packages/workflow-core/src";
```
