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

## Programmatic API (for OpenClaw)

```ts
import { startImageJob, getJob, handleFeedback } from "@fashionmentum/workflow-core";

// Start a job
const { jobId, status } = await startImageJob({
  productId: "pilates-mini-ball",
  workflowType: "NEUTRAL_PRODUCT_SHOT",
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
