import axios from "axios";
import { getEnv } from "../config/env";

export interface WorkflowGlobalSettings {
  modelId?: string;
  backgroundId?: string;
  outfit?: string;
  language?: string;
  aspectRatio?: string;
  resolution?: string;
  imageModel?: string;
}

export interface PlannedStep {
  index: number;
  type: "image" | "text" | "image_with_text";
  title: string;
  description: string;
  promptConfig: Record<string, unknown>;
}

export interface PlanWorkflowInput {
  description: string;
  globalSettings: WorkflowGlobalSettings;
}

export interface ReplanStepInput {
  workflowDescription: string;
  globalSettings: WorkflowGlobalSettings;
  existingSteps: PlannedStep[];
  stepIndex: number;
}

const PLAN_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    steps: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: {
            type: "string" as const,
            enum: ["image", "text", "image_with_text"],
            description: "The type of content to generate for this step.",
          },
          title: {
            type: "string" as const,
            description:
              "Short descriptive title for this step (max 80 chars).",
          },
          description: {
            type: "string" as const,
            description:
              "Detailed description of what this step produces and why.",
          },
          promptConfig: {
            type: "object" as const,
            properties: {
              workflowType: {
                type: "string" as const,
                description:
                  "One of: MAIN_IMAGE, NEUTRAL_PRODUCT_SHOT, LIFESTYLE, SCALE_REFERENCE, DETAIL_CLOSEUP, A_PLUS_VISUAL",
              },
              aspectRatio: {
                type: "string" as const,
                description: "Aspect ratio like 1:1, 4:5, 16:9",
              },
              resolution: {
                type: "string" as const,
                description: "Image size tier: 512, 1K, 2K, or 4K",
              },
              imageModel: {
                type: "string" as const,
                description:
                  "Gemini image model id: gemini-3.1-flash-image-preview or gemini-3-pro-image-preview",
              },
              poseDescription: {
                type: "string" as const,
                description:
                  "For lifestyle steps: description of the model pose and scene.",
              },
              textPrompt: {
                type: "string" as const,
                description:
                  "For text steps: the prompt to generate copy/listing text.",
              },
              layoutHint: {
                type: "string" as const,
                enum: ["grid_2col", "grid_3col", "list"],
                description:
                  "Suggested UI layout. grid_2col for 2-column image grids, grid_3col for 3-column, list for full-width text.",
              },
            },
            required: ["workflowType"],
          },
        },
        required: ["type", "title", "description", "promptConfig"],
      },
    },
  },
  required: ["steps"],
};

const REPLAN_STEP_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    type: {
      type: "string" as const,
      enum: ["image", "text", "image_with_text"],
    },
    title: { type: "string" as const },
    description: { type: "string" as const },
    promptConfig: {
      type: "object" as const,
      properties: {
        workflowType: { type: "string" as const },
        aspectRatio: { type: "string" as const },
        resolution: { type: "string" as const },
        imageModel: { type: "string" as const },
        poseDescription: { type: "string" as const },
        textPrompt: { type: "string" as const },
        layoutHint: {
          type: "string" as const,
          enum: ["grid_2col", "grid_3col", "list"],
        },
      },
      required: ["workflowType"],
    },
  },
  required: ["type", "title", "description", "promptConfig"],
};

const DRY_RUN_STEPS: PlannedStep[] = [
  {
    index: 0,
    type: "image",
    title: "[DRY RUN] Hero Product Shot",
    description:
      "Main product image on pure white background for primary listing.",
    promptConfig: {
      workflowType: "MAIN_IMAGE",
      aspectRatio: "1:1",
      layoutHint: "grid_2col",
    },
  },
  {
    index: 1,
    type: "image",
    title: "[DRY RUN] Lifestyle Scene",
    description:
      "Product in use by a model in a studio Pilates setting.",
    promptConfig: {
      workflowType: "LIFESTYLE",
      aspectRatio: "4:5",
      poseDescription: "Model in seated Pilates position using the product",
      layoutHint: "grid_2col",
    },
  },
  {
    index: 2,
    type: "text",
    title: "[DRY RUN] Amazon Listing Copy",
    description:
      "SEO-optimized title, bullet points and description for the Amazon listing.",
    promptConfig: {
      workflowType: "NEUTRAL_PRODUCT_SHOT",
      textPrompt: "Write Amazon listing copy for this product",
      layoutHint: "list",
    },
  },
];

function buildPlanPrompt(input: PlanWorkflowInput): string {
  const lang = input.globalSettings.language ?? "English";
  return (
    `You are a professional e-commerce product content strategist. ` +
    `A user described a custom workflow for product content creation:\n\n` +
    `"${input.description}"\n\n` +
    `Global settings:\n` +
    `- Language: ${lang}\n` +
    (input.globalSettings.modelId
      ? `- Human model ID: ${input.globalSettings.modelId}\n`
      : "") +
    (input.globalSettings.backgroundId
      ? `- Background ID: ${input.globalSettings.backgroundId}\n`
      : "") +
    (input.globalSettings.outfit
      ? `- Outfit: ${input.globalSettings.outfit}\n`
      : "") +
    (input.globalSettings.aspectRatio
      ? `- Default aspect ratio: ${input.globalSettings.aspectRatio}\n`
      : "") +
    (input.globalSettings.resolution
      ? `- Default resolution: ${input.globalSettings.resolution}\n`
      : "") +
    (input.globalSettings.imageModel
      ? `- Image model: ${input.globalSettings.imageModel}\n`
      : "") +
    `\nBreak this workflow into concrete sequential steps (3-10 steps). ` +
    `Each step should generate one piece of content (image, text, or image_with_text). ` +
    `For image steps, pick the most appropriate workflowType. ` +
    `For text steps, include a textPrompt in promptConfig. ` +
    `Order them logically (e.g. hero shot first, then lifestyle, then copy).`
  );
}

function buildReplanPrompt(input: ReplanStepInput): string {
  const stepsContext = input.existingSteps
    .map(
      (s) =>
        `  Step ${s.index}: [${s.type}] ${s.title} — ${s.description}`,
    )
    .join("\n");

  return (
    `You are a professional e-commerce product content strategist. ` +
    `A user has a custom workflow with this description:\n\n` +
    `"${input.workflowDescription}"\n\n` +
    `The current plan has these steps:\n${stepsContext}\n\n` +
    `Regenerate ONLY step ${input.stepIndex}. ` +
    `Keep it coherent with the other steps, but create a fresh approach. ` +
    `Maintain the same step type unless a different type is clearly better.`
  );
}

export async function planWorkflow(
  input: PlanWorkflowInput,
): Promise<PlannedStep[]> {
  const {
    NANOBANANA_API_KEY,
    NANOBANANA_BASE_URL,
    NANOBANANA_DRY_RUN,
    NANOBANANA_PLANNER_MODEL,
  } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    console.log("[WorkflowPlanner] Dry run — returning 3 example steps");
    return DRY_RUN_STEPS;
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for workflow planning.");
  }

  const prompt = buildPlanPrompt(input);
  const model = NANOBANANA_PLANNER_MODEL;
  const url = `${NANOBANANA_BASE_URL}/models/${model}:generateContent?key=${NANOBANANA_API_KEY}`;

  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PLAN_JSON_SCHEMA,
        temperature: 0.7,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    },
  );

  const textPart =
    response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Workflow planner returned no text content.");
  }

  let parsed: { steps: Array<Omit<PlannedStep, "index">> };
  try {
    parsed = JSON.parse(textPart);
  } catch {
    console.error(
      "Workflow plan JSON parse failed:",
      textPart.slice(0, 500),
    );
    throw new Error("Workflow planner returned invalid JSON.");
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Workflow planner returned no steps.");
  }

  return parsed.steps.map((s, i) => ({
    index: i,
    type: s.type,
    title: s.title,
    description: s.description,
    promptConfig: s.promptConfig,
  }));
}

export async function replanStep(
  input: ReplanStepInput,
): Promise<PlannedStep> {
  const {
    NANOBANANA_API_KEY,
    NANOBANANA_BASE_URL,
    NANOBANANA_DRY_RUN,
    NANOBANANA_PLANNER_MODEL,
  } = getEnv();

  if (NANOBANANA_DRY_RUN) {
    console.log(
      `[WorkflowPlanner] Dry run — returning replacement for step ${input.stepIndex}`,
    );
    const fallback = DRY_RUN_STEPS[input.stepIndex] ?? DRY_RUN_STEPS[0];
    return {
      ...fallback,
      index: input.stepIndex,
      title: `[DRY RUN] Replanned — ${fallback.title}`,
    };
  }

  if (!NANOBANANA_API_KEY) {
    throw new Error("API key not configured for workflow planning.");
  }

  const prompt = buildReplanPrompt(input);
  const model = NANOBANANA_PLANNER_MODEL;
  const url = `${NANOBANANA_BASE_URL}/models/${model}:generateContent?key=${NANOBANANA_API_KEY}`;

  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: REPLAN_STEP_JSON_SCHEMA,
        temperature: 0.8,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    },
  );

  const textPart =
    response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Step replanning returned no text content.");
  }

  let parsed: Omit<PlannedStep, "index">;
  try {
    parsed = JSON.parse(textPart);
  } catch {
    console.error(
      "Step replan JSON parse failed:",
      textPart.slice(0, 500),
    );
    throw new Error("Step replanning returned invalid JSON.");
  }

  return {
    index: input.stepIndex,
    type: parsed.type,
    title: parsed.title,
    description: parsed.description,
    promptConfig: parsed.promptConfig,
  };
}
