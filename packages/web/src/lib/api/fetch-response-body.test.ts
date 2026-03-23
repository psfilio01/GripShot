import { describe, it, expect } from "vitest";
import {
  readFetchResponseBody,
  messageFromApiFailure,
} from "./fetch-response-body";

describe("readFetchResponseBody", () => {
  it("parses JSON object", async () => {
    const res = new Response('{"error":"boom"}', { status: 500 });
    const { data, rawText } = await readFetchResponseBody(res);
    expect(data).toEqual({ error: "boom" });
    expect(rawText).toBe('{"error":"boom"}');
  });

  it("returns null data for invalid JSON", async () => {
    const res = new Response("not json", { status: 500 });
    const { data, rawText } = await readFetchResponseBody(res);
    expect(data).toBeNull();
    expect(rawText).toBe("not json");
  });
});

describe("messageFromApiFailure", () => {
  it("uses data.error when present", () => {
    const res = new Response(null, { status: 503 });
    const msg = messageFromApiFailure(
      res,
      {
        error:
          "HTTP 503 (UNAVAILABLE): This model is currently experiencing high demand.",
      },
      "",
      "Generation failed",
    );
    expect(msg).toContain("high demand");
  });

  it("falls back to raw text when JSON missing error field", () => {
    const res = new Response(null, { status: 502 });
    expect(
      messageFromApiFailure(res, null, "Bad gateway from proxy", "Failed"),
    ).toBe("Bad gateway from proxy");
  });

  it("uses status when body empty", () => {
    const res = new Response(null, { status: 500 });
    expect(messageFromApiFailure(res, null, "", "Generation failed")).toBe(
      "Generation failed (500)",
    );
  });
});
