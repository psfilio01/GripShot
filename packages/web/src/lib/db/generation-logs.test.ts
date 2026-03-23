import { describe, expect, it } from "vitest";
import { omitUndefinedRecord } from "./generation-logs";

describe("omitUndefinedRecord", () => {
  it("removes undefined values for Firestore-safe payloads", () => {
    expect(
      omitUndefinedRecord({
        a: 1,
        b: undefined,
        c: "x",
        d: null,
      }),
    ).toEqual({ a: 1, c: "x", d: null });
  });
});
