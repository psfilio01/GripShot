import { describe, it, expect } from "vitest";
import { filePathToGeneratedImageUrl } from "./generated-public-url";

describe("filePathToGeneratedImageUrl", () => {
  it("prefixes generated segment for API route", () => {
    expect(
      filePathToGeneratedImageUrl(
        "/app/data/generated/my-product/job1/neutral/abc.png",
      ),
    ).toBe("/api/images/generated/my-product/job1/neutral/abc.png");
  });

  it("normalizes Windows backslashes", () => {
    expect(
      filePathToGeneratedImageUrl(
        "C:\\app\\data\\generated\\p1\\j1\\favorites\\x.webp",
      ),
    ).toBe("/api/images/generated/p1/j1/favorites/x.webp");
  });

  it("encodes path segments", () => {
    expect(
      filePathToGeneratedImageUrl(
        "/data/generated/weird id/job/neutral/file.png",
      ),
    ).toBe("/api/images/generated/weird%20id/job/neutral/file.png");
  });

  it("returns original string when no /generated/ marker", () => {
    expect(filePathToGeneratedImageUrl("/tmp/other.png")).toBe("/tmp/other.png");
  });
});
