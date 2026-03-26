import { describe, it, expect } from "vitest";
import { parseGeneratedTrailing } from "./generated-request-path";

describe("parseGeneratedTrailing", () => {
  it("parses single-segment product folder (may include spaces when encoded)", () => {
    expect(
      parseGeneratedTrailing([
        "generated",
        "Pilates Block",
        "job123",
        "neutral",
        "a.png",
      ]),
    ).toEqual({ jobId: "job123", bucket: "neutral", fileName: "a.png" });
  });

  it("parses when product path is split across multiple segments", () => {
    expect(
      parseGeneratedTrailing([
        "generated",
        "Pilates",
        "Block",
        "job123",
        "neutral",
        "a.png",
      ]),
    ).toEqual({ jobId: "job123", bucket: "neutral", fileName: "a.png" });
  });

  it("returns null when too short", () => {
    expect(
      parseGeneratedTrailing(["generated", "p", "j", "n"]),
    ).toBeNull();
  });

  it("returns null for invalid bucket", () => {
    expect(
      parseGeneratedTrailing([
        "generated",
        "p",
        "job",
        "unknown",
        "a.png",
      ]),
    ).toBeNull();
  });
});
