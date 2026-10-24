import { describe, it, expect } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers extracted from the batch-generate logic              */
/* ------------------------------------------------------------------ */

type StepType = "image" | "text" | "image_with_text";
type StepStatus = "planned" | "generating" | "completed" | "failed";

interface Step {
  index: number;
  type: StepType;
  status: StepStatus;
}

/** Count the image credits a batch of steps will consume. */
function countBatchCost(steps: Step[]): number {
  return steps.filter(
    (s) => s.type === "image" || s.type === "image_with_text",
  ).length;
}

/** Select which steps are actionable (planned or failed). */
function selectActionable(steps: Step[]): Step[] {
  return steps.filter((s) => s.status === "planned" || s.status === "failed");
}

/** Trim actionable list to what the remaining quota allows. */
function trimToQuota(actionable: Step[], remaining: number): Step[] {
  if (remaining >= actionable.length) return actionable;
  return actionable.slice(0, remaining);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("countBatchCost", () => {
  it("counts image and image_with_text steps", () => {
    const steps: Step[] = [
      { index: 0, type: "image", status: "planned" },
      { index: 1, type: "text", status: "planned" },
      { index: 2, type: "image_with_text", status: "planned" },
      { index: 3, type: "image", status: "planned" },
    ];
    expect(countBatchCost(steps)).toBe(3);
  });

  it("returns 0 for text-only steps", () => {
    const steps: Step[] = [
      { index: 0, type: "text", status: "planned" },
      { index: 1, type: "text", status: "planned" },
    ];
    expect(countBatchCost(steps)).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(countBatchCost([])).toBe(0);
  });
});

describe("selectActionable", () => {
  it("includes planned and failed steps", () => {
    const steps: Step[] = [
      { index: 0, type: "image", status: "planned" },
      { index: 1, type: "image", status: "completed" },
      { index: 2, type: "image", status: "failed" },
      { index: 3, type: "text", status: "generating" },
    ];
    const result = selectActionable(steps);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.index)).toEqual([0, 2]);
  });

  it("returns empty list when all steps are completed", () => {
    const steps: Step[] = [
      { index: 0, type: "image", status: "completed" },
      { index: 1, type: "text", status: "completed" },
    ];
    expect(selectActionable(steps)).toHaveLength(0);
  });
});

describe("trimToQuota", () => {
  const actionable: Step[] = [0, 1, 2, 3, 4].map((i) => ({
    index: i,
    type: "image" as StepType,
    status: "planned" as StepStatus,
  }));

  it("returns all steps when remaining >= count", () => {
    expect(trimToQuota(actionable, 10)).toHaveLength(5);
    expect(trimToQuota(actionable, 5)).toHaveLength(5);
  });

  it("trims to remaining when quota is insufficient", () => {
    const trimmed = trimToQuota(actionable, 3);
    expect(trimmed).toHaveLength(3);
    expect(trimmed.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("returns empty list when remaining is 0", () => {
    expect(trimToQuota(actionable, 0)).toHaveLength(0);
  });

  it("handles empty actionable list gracefully", () => {
    expect(trimToQuota([], 5)).toHaveLength(0);
  });
});

describe("batch quota decision", () => {
  it("shows dialog when image steps exceed remaining credits", () => {
    const actionable: Step[] = [
      { index: 0, type: "image", status: "planned" },
      { index: 1, type: "image", status: "planned" },
      { index: 2, type: "text", status: "planned" },
    ];
    const imageCost = countBatchCost(actionable);
    const remaining = 1;
    expect(imageCost > remaining).toBe(true);
  });

  it("does not show dialog when credits are sufficient", () => {
    const actionable: Step[] = [
      { index: 0, type: "image", status: "planned" },
      { index: 1, type: "image", status: "planned" },
    ];
    const imageCost = countBatchCost(actionable);
    const remaining = 10;
    expect(imageCost > remaining).toBe(false);
  });

  it("does not show dialog when batch has no image steps", () => {
    const actionable: Step[] = [
      { index: 0, type: "text", status: "planned" },
    ];
    const imageCost = countBatchCost(actionable);
    expect(imageCost).toBe(0);
  });
});
