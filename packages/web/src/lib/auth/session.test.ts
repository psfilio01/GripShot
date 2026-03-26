import { describe, it, expect } from "vitest";
import {
  isPublicPath,
  pathnameWithoutLocale,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
} from "./session";

describe("session helpers", () => {
  it("strips locale prefix from pathname", () => {
    expect(pathnameWithoutLocale("/en")).toEqual({
      locale: "en",
      pathWithoutLocale: "/",
    });
    expect(pathnameWithoutLocale("/de/dashboard")).toEqual({
      locale: "de",
      pathWithoutLocale: "/dashboard",
    });
    expect(pathnameWithoutLocale("/en/login")).toEqual({
      locale: "en",
      pathWithoutLocale: "/login",
    });
    expect(pathnameWithoutLocale("/unknown/x")).toBeNull();
  });

  it("identifies public paths", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login?redirect=/dashboard")).toBe(true);
    expect(isPublicPath("/api/auth/session")).toBe(true);
    expect(isPublicPath("/api/billing/webhook")).toBe(true);
  });

  it("identifies protected paths", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/dashboard/products")).toBe(false);
    expect(isPublicPath("/api/generate")).toBe(false);
  });

  it("exports correct cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("__session");
  });

  it("session max age is 5 days", () => {
    expect(SESSION_MAX_AGE_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
});
