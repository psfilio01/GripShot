import { describe, it, expect } from "vitest";
import { formatGoogleGenerativeLanguageApiError } from "./googleGenerativeLanguageError";

describe("formatGoogleGenerativeLanguageApiError", () => {
  it("formats Gemini 503 UNAVAILABLE JSON body", () => {
    const body = {
      error: {
        code: 503,
        message:
          "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
        status: "UNAVAILABLE",
      },
    };
    const s = formatGoogleGenerativeLanguageApiError(503, body);
    expect(s).toContain("503");
    expect(s).toContain("UNAVAILABLE");
    expect(s).toContain("high demand");
  });

  it("parses JSON string bodies", () => {
    const raw = JSON.stringify({
      error: { code: 429, message: "Resource exhausted", status: "RESOURCE_EXHAUSTED" },
    });
    const s = formatGoogleGenerativeLanguageApiError(429, raw);
    expect(s).toContain("429");
    expect(s).toContain("Resource exhausted");
  });

  it("returns empty string for empty input", () => {
    expect(formatGoogleGenerativeLanguageApiError(undefined, {})).toBe("");
  });
});
