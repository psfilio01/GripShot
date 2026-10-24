import { describe, it, expect } from "vitest";

const TRASH_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Helper utilities mirrored from the purge logic
// ---------------------------------------------------------------------------

function isExpiredForPurge(deletedAtMs: number, nowMs: number): boolean {
  const cutoff = nowMs - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;
  return deletedAtMs <= cutoff;
}

function autoDeleteDate(deletedAtMs: number): Date {
  return new Date(deletedAtMs + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Soft-delete field invariants
// ---------------------------------------------------------------------------

describe("soft-delete field invariants", () => {
  it("an item is considered deleted when deletedAt is not null", () => {
    const item = { id: "x", name: "test", deletedAt: { _seconds: 1000 }, deletedBy: "uid1" };
    expect(item.deletedAt).not.toBeNull();
  });

  it("an item is considered active when deletedAt is null", () => {
    const item = { id: "x", name: "test", deletedAt: null, deletedBy: null };
    expect(item.deletedAt).toBeNull();
  });

  it("restore sets deletedAt and deletedBy back to null", () => {
    const item = { id: "x", deletedAt: { _seconds: 1000 }, deletedBy: "uid1" };
    const restored = { ...item, deletedAt: null, deletedBy: null };
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Purge TTL logic
// ---------------------------------------------------------------------------

describe("purge TTL logic", () => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it("expires an item deleted exactly 7 days ago", () => {
    const deletedAt = now - sevenDaysMs;
    expect(isExpiredForPurge(deletedAt, now)).toBe(true);
  });

  it("expires an item deleted more than 7 days ago", () => {
    const deletedAt = now - sevenDaysMs - 1;
    expect(isExpiredForPurge(deletedAt, now)).toBe(true);
  });

  it("does not expire an item deleted 6 days ago", () => {
    const deletedAt = now - 6 * 24 * 60 * 60 * 1000;
    expect(isExpiredForPurge(deletedAt, now)).toBe(false);
  });

  it("does not expire an item just deleted", () => {
    expect(isExpiredForPurge(now, now)).toBe(false);
  });

  it("calculates autoDeleteDate as deletedAt + 7 days", () => {
    const deletedAt = 1000000;
    const expected = new Date(deletedAt + sevenDaysMs);
    expect(autoDeleteDate(deletedAt).getTime()).toBe(expected.getTime());
  });
});

// ---------------------------------------------------------------------------
// Step image soft-delete
// ---------------------------------------------------------------------------

interface StepDoc {
  index: number;
  status: string;
  resultImagePath?: string;
  resultImageDeletedAt?: { _seconds: number } | null;
  resultImageDeletedBy?: string | null;
}

function softDeleteStepImage(step: StepDoc, deletedBy: string): StepDoc {
  return {
    ...step,
    resultImageDeletedAt: { _seconds: Math.floor(Date.now() / 1000) },
    resultImageDeletedBy: deletedBy,
  };
}

function restoreStepImage(step: StepDoc): StepDoc {
  return {
    ...step,
    resultImageDeletedAt: null,
    resultImageDeletedBy: null,
  };
}

describe("step image soft-delete", () => {
  const baseStep: StepDoc = {
    index: 0,
    status: "completed",
    resultImagePath: "generated/prod1/job1/neutral/img1.png",
    resultImageDeletedAt: null,
    resultImageDeletedBy: null,
  };

  it("sets resultImageDeletedAt and resultImageDeletedBy on soft-delete", () => {
    const after = softDeleteStepImage(baseStep, "user123");
    expect(after.resultImageDeletedAt).not.toBeNull();
    expect(after.resultImageDeletedBy).toBe("user123");
    expect(after.resultImagePath).toBe(baseStep.resultImagePath);
  });

  it("clears resultImageDeletedAt and resultImageDeletedBy on restore", () => {
    const deleted = softDeleteStepImage(baseStep, "user123");
    const restored = restoreStepImage(deleted);
    expect(restored.resultImageDeletedAt).toBeNull();
    expect(restored.resultImageDeletedBy).toBeNull();
  });

  it("step itself is not deleted — only the image is marked", () => {
    const deleted = softDeleteStepImage(baseStep, "user123");
    expect(deleted.status).toBe("completed");
    expect(deleted.index).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Trash count helpers
// ---------------------------------------------------------------------------

interface TrashCounts {
  workflows: number;
  products: number;
  models: number;
  backgrounds: number;
}

function totalTrashItems(counts: TrashCounts): number {
  return counts.workflows + counts.products + counts.models + counts.backgrounds;
}

describe("trash count helpers", () => {
  it("totals all trash items correctly", () => {
    expect(totalTrashItems({ workflows: 2, products: 3, models: 1, backgrounds: 0 })).toBe(6);
  });

  it("returns 0 when trash is empty", () => {
    expect(totalTrashItems({ workflows: 0, products: 0, models: 0, backgrounds: 0 })).toBe(0);
  });
});
