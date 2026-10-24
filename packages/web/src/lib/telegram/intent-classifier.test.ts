import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fashionmentum/workflow-core", () => ({
  formatGoogleGenerativeLanguageApiError: vi.fn(
    (status: number) => `API error ${status}`,
  ),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  }),
}));

function mockGeminiResponse(intent: string, description?: string) {
  const result: Record<string, unknown> = { intent };
  if (description) result.description = description;

  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(result) }],
        },
      },
    ],
  };
}

describe("intent-classifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("returns dry-run result when GEMINI_DRY_RUN=true", async () => {
    process.env.GEMINI_DRY_RUN = "true";
    const { classifyIntent } = await import("./intent-classifier");

    const result = await classifyIntent("Erstell mir 10 Pilates-Übungen");

    expect(result.intent).toBe("create_workflow");
    expect(result.description).toContain("DRY RUN");
  });

  it("parses a valid create_workflow response from Gemini", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            mockGeminiResponse(
              "create_workflow",
              "Create 10 Pilates exercises with mini ball for a flyer",
            ),
          ),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Erstell mir 10 Pilates-Übungen mit Miniball");

    expect(result.intent).toBe("create_workflow");
    expect(result.description).toContain("Pilates");
  });

  it("parses a question intent", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse("question")),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Wie viele Credits habe ich noch?");

    expect(result.intent).toBe("question");
  });

  it("parses a create_model intent", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            mockGeminiResponse("create_model", "A young athletic woman"),
          ),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Leg ein neues Model an: sportliche junge Frau");

    expect(result.intent).toBe("create_model");
    expect(result.description).toBeDefined();
  });

  it("parses a create_background intent", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse("create_background")),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Erstell einen neuen Hintergrund: Yoga Studio");

    expect(result.intent).toBe("create_background");
  });

  it("parses a create_product intent", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            mockGeminiResponse("create_product", "Yoga mat product"),
          ),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Leg ein neues Produkt an: Yogamatte");

    expect(result.intent).toBe("create_product");
  });

  it("parses a feedback intent", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse("feedback")),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("Das Bild ist zu dunkel");

    expect(result.intent).toBe("feedback");
  });

  it("falls back to unknown on invalid JSON response", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "not json at all" }],
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("random gibberish");

    expect(result.intent).toBe("unknown");
  });

  it("falls back to unknown on missing response text", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    const mockResponse = { candidates: [{ content: { parts: [] } }] };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("test");

    expect(result.intent).toBe("unknown");
  });

  it("throws on API error", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");

    await expect(classifyIntent("test")).rejects.toThrow();
  });

  it("falls back to unknown for unrecognized intent values", async () => {
    process.env.GEMINI_DRY_RUN = "false";
    process.env.GEMINI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse("bogus_intent")),
      }),
    );

    const { classifyIntent } = await import("./intent-classifier");
    const result = await classifyIntent("test");

    expect(result.intent).toBe("unknown");
  });
});
