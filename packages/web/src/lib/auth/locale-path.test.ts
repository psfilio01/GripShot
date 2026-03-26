import { describe, it, expect } from "vitest";
import { isAppLocale, pathnameWithLocale } from "./locale-path";

describe("locale-path", () => {
  it("isAppLocale validates routing locales", () => {
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("de")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(isAppLocale(undefined)).toBe(false);
  });

  it("pathnameWithLocale prefixes dashboard paths", () => {
    expect(pathnameWithLocale("/dashboard/settings", "de")).toBe(
      "/de/dashboard/settings",
    );
    expect(pathnameWithLocale("/", "en")).toBe("/en");
    expect(pathnameWithLocale("", "de")).toBe("/de");
  });
});
