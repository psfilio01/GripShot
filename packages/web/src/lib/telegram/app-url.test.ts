import { describe, expect, it } from "vitest";
import { isTelegramInlineButtonUrlAllowed } from "./app-url";

describe("isTelegramInlineButtonUrlAllowed", () => {
  it("allows public https URLs", () => {
    expect(
      isTelegramInlineButtonUrlAllowed("https://app.example.com/en/dashboard"),
    ).toBe(true);
  });

  it("rejects localhost", () => {
    expect(
      isTelegramInlineButtonUrlAllowed("http://localhost:3000/en/dashboard"),
    ).toBe(false);
  });

  it("rejects 127.0.0.1", () => {
    expect(
      isTelegramInlineButtonUrlAllowed("http://127.0.0.1:3000/foo"),
    ).toBe(false);
  });

  it("rejects ::1", () => {
    expect(isTelegramInlineButtonUrlAllowed("http://[::1]:3000/")).toBe(false);
  });
});
