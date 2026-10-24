import { describe, expect, it } from "vitest";
import { qualityScoreVariant } from "./quality-score";

describe("qualityScoreVariant", () => {
  it("returns green for score > 7", () => {
    expect(qualityScoreVariant(8)).toBe("green");
    expect(qualityScoreVariant(9)).toBe("green");
    expect(qualityScoreVariant(10)).toBe("green");
    expect(qualityScoreVariant(7.1)).toBe("green");
  });

  it("returns amber for score between 4 and 7 (inclusive)", () => {
    expect(qualityScoreVariant(7)).toBe("amber");
    expect(qualityScoreVariant(5)).toBe("amber");
    expect(qualityScoreVariant(4)).toBe("amber");
  });

  it("returns red for score < 4", () => {
    expect(qualityScoreVariant(3)).toBe("red");
    expect(qualityScoreVariant(1)).toBe("red");
    expect(qualityScoreVariant(0)).toBe("red");
  });

  it("boundary: 7 is amber, 7.1 is green", () => {
    expect(qualityScoreVariant(7)).toBe("amber");
    expect(qualityScoreVariant(7.1)).toBe("green");
  });

  it("boundary: 4 is amber, 3.9 is red", () => {
    expect(qualityScoreVariant(4)).toBe("amber");
    expect(qualityScoreVariant(3.9)).toBe("red");
  });
});
