import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/env", () => ({
  getEnv: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

import { planWorkflow, replanStep } from "./workflowPlanner";
import type { PlanWorkflowInput, ReplanStepInput, PlannedStep } from "./workflowPlanner";
import { getEnv } from "../config/env";

const mockGetEnv = vi.mocked(getEnv);

function makePlanInput(overrides: Partial<PlanWorkflowInput> = {}): PlanWorkflowInput {
  return {
    description: "Create a full Amazon listing for a Pilates mini ball",
    globalSettings: { language: "English" },
    ...overrides,
  };
}

function makeReplanInput(overrides: Partial<ReplanStepInput> = {}): ReplanStepInput {
  return {
    workflowDescription: "Full Amazon listing for a Pilates mini ball",
    globalSettings: { language: "English" },
    existingSteps: [
      { index: 0, type: "image", title: "Hero Shot", description: "Main image", promptConfig: { workflowType: "MAIN_IMAGE" } },
      { index: 1, type: "image", title: "Lifestyle", description: "Lifestyle shot", promptConfig: { workflowType: "LIFESTYLE" } },
      { index: 2, type: "text", title: "Copy", description: "Listing text", promptConfig: { workflowType: "NEUTRAL_PRODUCT_SHOT", textPrompt: "Write copy" } },
    ],
    stepIndex: 1,
    ...overrides,
  };
}

function dryRunEnv() {
  return {
    NODE_ENV: "development" as const,
    WORKFLOW_DATA_ROOT: "/data",
    NANOBANANA_API_KEY: "",
    NANOBANANA_BASE_URL: "https://example.com",
    NANOBANANA_MODEL: "test",
    NANOBANANA_PLANNER_MODEL: "gemini-2.5-flash",
    NANOBANANA_DRY_RUN: true,
  };
}

function liveEnv() {
  return {
    NODE_ENV: "development" as const,
    WORKFLOW_DATA_ROOT: "/data",
    NANOBANANA_API_KEY: "test-key",
    NANOBANANA_BASE_URL: "https://api.example.com/v1beta",
    NANOBANANA_MODEL: "test",
    NANOBANANA_PLANNER_MODEL: "gemini-2.5-flash",
    NANOBANANA_DRY_RUN: false,
  };
}

describe("planWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 3 dry-run steps when NANOBANANA_DRY_RUN is true", async () => {
    mockGetEnv.mockReturnValue(dryRunEnv());

    const steps = await planWorkflow(makePlanInput());

    expect(steps).toHaveLength(3);
    expect(steps[0].title).toContain("[DRY RUN]");
    expect(steps[0].type).toBe("image");
    expect(steps[1].type).toBe("image");
    expect(steps[2].type).toBe("text");
    expect(steps[0].index).toBe(0);
    expect(steps[1].index).toBe(1);
    expect(steps[2].index).toBe(2);
  });

  it("throws when API key is missing and not in dry-run", async () => {
    mockGetEnv.mockReturnValue({
      ...liveEnv(),
      NANOBANANA_API_KEY: undefined as unknown as string,
    });

    await expect(planWorkflow(makePlanInput())).rejects.toThrow(
      "API key not configured",
    );
  });

  it("calls Gemini API and parses steps correctly", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const geminiResponse: PlannedStep[] = [
      { index: 0, type: "image", title: "Hero Shot", description: "Main image", promptConfig: { workflowType: "MAIN_IMAGE", aspectRatio: "1:1" } },
      { index: 1, type: "image", title: "Lifestyle", description: "In use", promptConfig: { workflowType: "LIFESTYLE", aspectRatio: "4:5" } },
    ];

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({ steps: geminiResponse }),
            }],
          },
        }],
      },
    });

    const steps = await planWorkflow(makePlanInput());

    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe("Hero Shot");
    expect(steps[0].type).toBe("image");
    expect(steps[0].index).toBe(0);
    expect(steps[1].index).toBe(1);

    expect(axios.default.post).toHaveBeenCalledOnce();
    const [url, body] = vi.mocked(axios.default.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toContain("gemini-2.5-flash");
    expect(url).toContain("test-key");
    expect((body.generationConfig as Record<string, unknown>).responseMimeType).toBe("application/json");
  });

  it("uses NANOBANANA_PLANNER_MODEL in the request URL", async () => {
    mockGetEnv.mockReturnValue({
      ...liveEnv(),
      NANOBANANA_PLANNER_MODEL: "gemini-2.0-flash",
    });

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                steps: [
                  { type: "image", title: "A", description: "A", promptConfig: { workflowType: "MAIN_IMAGE" } },
                ],
              }),
            }],
          },
        }],
      },
    });

    await planWorkflow(makePlanInput());

    const [url] = vi.mocked(axios.default.post).mock.calls[0] as [string];
    expect(url).toContain("gemini-2.0-flash");
  });

  it("throws on empty steps array from Gemini", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ steps: [] }) }] },
        }],
      },
    });

    await expect(planWorkflow(makePlanInput())).rejects.toThrow(
      "no steps",
    );
  });

  it("throws on invalid JSON from Gemini", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: { parts: [{ text: "not json at all" }] },
        }],
      },
    });

    await expect(planWorkflow(makePlanInput())).rejects.toThrow(
      "invalid JSON",
    );
  });

  it("assigns sequential indices even if Gemini returns wrong ones", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                steps: [
                  { type: "image", title: "A", description: "A", promptConfig: { workflowType: "MAIN_IMAGE" } },
                  { type: "text", title: "B", description: "B", promptConfig: { workflowType: "MAIN_IMAGE" } },
                ],
              }),
            }],
          },
        }],
      },
    });

    const steps = await planWorkflow(makePlanInput());
    expect(steps[0].index).toBe(0);
    expect(steps[1].index).toBe(1);
  });
});

describe("replanStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry-run replacement when NANOBANANA_DRY_RUN is true", async () => {
    mockGetEnv.mockReturnValue(dryRunEnv());

    const step = await replanStep(makeReplanInput());

    expect(step.index).toBe(1);
    expect(step.title).toContain("[DRY RUN]");
    expect(step.title).toContain("Replanned");
  });

  it("falls back to first dry-run step for out-of-range index", async () => {
    mockGetEnv.mockReturnValue(dryRunEnv());

    const step = await replanStep(makeReplanInput({ stepIndex: 99 }));

    expect(step.index).toBe(99);
    expect(step.title).toContain("[DRY RUN]");
  });

  it("throws when API key is missing and not in dry-run", async () => {
    mockGetEnv.mockReturnValue({
      ...liveEnv(),
      NANOBANANA_API_KEY: undefined as unknown as string,
    });

    await expect(replanStep(makeReplanInput())).rejects.toThrow(
      "API key not configured",
    );
  });

  it("calls Gemini API and returns replanned step", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                type: "image",
                title: "New Lifestyle Shot",
                description: "Fresh approach to lifestyle",
                promptConfig: { workflowType: "LIFESTYLE", poseDescription: "Standing with product" },
              }),
            }],
          },
        }],
      },
    });

    const step = await replanStep(makeReplanInput());

    expect(step.index).toBe(1);
    expect(step.title).toBe("New Lifestyle Shot");
    expect(step.type).toBe("image");
    expect(step.promptConfig.workflowType).toBe("LIFESTYLE");

    expect(axios.default.post).toHaveBeenCalledOnce();
    const [url] = vi.mocked(axios.default.post).mock.calls[0] as [string];
    expect(url).toContain("gemini-2.5-flash");
  });

  it("includes existing steps context in Gemini prompt", async () => {
    mockGetEnv.mockReturnValue(liveEnv());

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                type: "image",
                title: "Replanned",
                description: "New",
                promptConfig: { workflowType: "LIFESTYLE" },
              }),
            }],
          },
        }],
      },
    });

    await replanStep(makeReplanInput());

    const [, body] = vi.mocked(axios.default.post).mock.calls[0] as [string, Record<string, unknown>];
    const contents = body.contents as Array<{ parts: Array<{ text: string }> }>;
    const promptText = contents[0].parts[0].text;
    expect(promptText).toContain("Hero Shot");
    expect(promptText).toContain("Lifestyle");
    expect(promptText).toContain("step 1");
  });
});
