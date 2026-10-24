import { describe, it, expect, vi } from "vitest";
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

  it("returns ADC hint when default credentials are missing and GCS is enabled", async () => {
    vi.stubEnv("WORKFLOW_GCS_BUCKET", "some-bucket");
    vi.resetModules();
    const { formatWorkflowStorageError: fmt } = await import("./objectStorage");
    const hint = fmt(
      new Error(
        "Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.",
      ),
    );
    expect(hint).toContain("gcloud auth application-default login");
    expect(hint).toContain("WORKFLOW_GCS_BUCKET");
    vi.unstubAllEnvs();
  });
});
