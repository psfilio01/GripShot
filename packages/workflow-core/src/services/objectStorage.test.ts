import { describe, it, expect } from "vitest";
import { formatWorkflowStorageError } from "./objectStorage";

describe("formatWorkflowStorageError", () => {
  it("returns a hint for GCS bucket missing errors", () => {
    const hint = formatWorkflowStorageError(
      new Error("The specified bucket does not exist."),
    );
    expect(hint).toMatch(/Google Cloud Storage bucket/);
    expect(hint).toMatch(/WORKFLOW_GCS_BUCKET|bucket/);
  });

  it("returns null for unrelated errors", () => {
    expect(
      formatWorkflowStorageError(new Error("Nano Banana API key not configured.")),
    ).toBeNull();
  });
});
