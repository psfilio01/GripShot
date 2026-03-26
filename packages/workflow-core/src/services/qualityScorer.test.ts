import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/env", () => ({
  getEnv: vi.fn(),
}));

vi.mock("fs-extra", () => ({
  default: { readFile: vi.fn() },
}));

vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

import { scoreImageQuality } from "./qualityScorer";
import { getEnv } from "../config/env";
import type { QualityScorerInput } from "../domain/qualityScore";

const mockGetEnv = vi.mocked(getEnv);

function makeInput(overrides: Partial<QualityScorerInput> = {}): QualityScorerInput {
  return {
    imagePath: "/tmp/test-image.jpg",
    workflowType: "MAIN_IMAGE",
    productName: "Test Product",
    productCategory: "handheld",
    ...overrides,
  };
}

describe("scoreImageQuality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry-run score when NANOBANANA_DRY_RUN is true", async () => {
    mockGetEnv.mockReturnValue({
      NODE_ENV: "development",
      WORKFLOW_DATA_ROOT: "/data",
      NANOBANANA_API_KEY: "",
      NANOBANANA_BASE_URL: "https://example.com",
      NANOBANANA_MODEL: "test",
      NANOBANANA_DRY_RUN: true,
    });

    const score = await scoreImageQuality(makeInput());

    expect(score.overallScore).toBe(8);
    expect(score.productVisible).toBe(true);
    expect(score.proportionsPlausible).toBe(true);
    expect(score.goalMet).toBe(true);
    expect(score.issues).toEqual([]);
  });

  it("throws when API key is missing and not in dry-run mode", async () => {
    mockGetEnv.mockReturnValue({
      NODE_ENV: "development",
      WORKFLOW_DATA_ROOT: "/data",
      NANOBANANA_API_KEY: undefined as unknown as string,
      NANOBANANA_BASE_URL: "https://example.com",
      NANOBANANA_MODEL: "test",
      NANOBANANA_DRY_RUN: false,
    });

    await expect(scoreImageQuality(makeInput())).rejects.toThrow(
      "API key not configured",
    );
  });

  it("calls Gemini API with correct parameters when not in dry-run", async () => {
    mockGetEnv.mockReturnValue({
      NODE_ENV: "development",
      WORKFLOW_DATA_ROOT: "/data",
      NANOBANANA_API_KEY: "test-key",
      NANOBANANA_BASE_URL: "https://api.example.com/v1beta",
      NANOBANANA_MODEL: "test",
      NANOBANANA_DRY_RUN: false,
    });

    const fs = await import("fs-extra");
    vi.mocked(fs.default.readFile).mockResolvedValue(Buffer.from("fake-image") as never);

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                overallScore: 7,
                productVisible: true,
                proportionsPlausible: true,
                goalMet: false,
                issues: ["background not pure white"],
              }),
            }],
          },
        }],
      },
    });

    const score = await scoreImageQuality(makeInput());

    expect(score.overallScore).toBe(7);
    expect(score.productVisible).toBe(true);
    expect(score.goalMet).toBe(false);
    expect(score.issues).toEqual(["background not pure white"]);

    expect(axios.default.post).toHaveBeenCalledOnce();
    const [url, body] = vi.mocked(axios.default.post).mock.calls[0] as [string, Record<string, any>];
    expect(url).toContain("gemini-2.5-flash");
    expect(url).toContain("test-key");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("clamps scores outside 1-10 range", async () => {
    mockGetEnv.mockReturnValue({
      NODE_ENV: "development",
      WORKFLOW_DATA_ROOT: "/data",
      NANOBANANA_API_KEY: "test-key",
      NANOBANANA_BASE_URL: "https://api.example.com/v1beta",
      NANOBANANA_MODEL: "test",
      NANOBANANA_DRY_RUN: false,
    });

    const fs = await import("fs-extra");
    vi.mocked(fs.default.readFile).mockResolvedValue(Buffer.from("img") as never);

    const axios = await import("axios");
    vi.mocked(axios.default.post).mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                overallScore: 15,
                productVisible: true,
                proportionsPlausible: true,
                goalMet: true,
                issues: [],
              }),
            }],
          },
        }],
      },
    });

    const score = await scoreImageQuality(makeInput());
    expect(score.overallScore).toBe(10);
  });
});
