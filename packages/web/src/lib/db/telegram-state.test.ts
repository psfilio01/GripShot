import { describe, it, expect } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { telegramStateToFirestoreMergePayload } from "./telegram-state";

describe("telegramStateToFirestoreMergePayload", () => {
  it("turns top-level undefined into FieldValue.delete()", () => {
    const patch = telegramStateToFirestoreMergePayload({
      phase: "awaiting_settings",
      activeWorkflowId: undefined,
      activeStepIndex: undefined,
    });
    expect(patch.phase).toBe("awaiting_settings");
    expect(patch.activeWorkflowId).toEqual(FieldValue.delete());
    expect(patch.activeStepIndex).toEqual(FieldValue.delete());
  });

  it("replaces nested undefined in pendingSettings with FieldValue.delete()", () => {
    const patch = telegramStateToFirestoreMergePayload({
      pendingSettings: { modelId: "m1", backgroundId: undefined, language: "de" },
    });
    const ps = patch.pendingSettings as Record<string, unknown>;
    expect(ps.modelId).toBe("m1");
    expect(ps.language).toBe("de");
    expect(ps.backgroundId).toEqual(FieldValue.delete());
  });

  it("passes through defined scalar fields", () => {
    const patch = telegramStateToFirestoreMergePayload({
      phase: "generating",
      activeWorkflowId: "wf-1",
      activeStepIndex: 2,
    });
    expect(patch).toEqual({
      phase: "generating",
      activeWorkflowId: "wf-1",
      activeStepIndex: 2,
    });
  });
});
