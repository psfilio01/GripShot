import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramCallbackQuery } from "./types";
import type { UserDoc } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  }),
}));

const mockSendMessage = vi.fn();
const mockSendPhoto = vi.fn().mockResolvedValue(42);
const mockEditMessageText = vi.fn();
const mockEditMessageReplyMarkup = vi.fn();
const mockAnswerCallbackQuery = vi.fn();

vi.mock("./client", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendPhoto: (...args: unknown[]) => mockSendPhoto(...args),
  editMessageText: (...args: unknown[]) => mockEditMessageText(...args),
  editMessageReplyMarkup: (...args: unknown[]) => mockEditMessageReplyMarkup(...args),
  answerCallbackQuery: (...args: unknown[]) => mockAnswerCallbackQuery(...args),
}));

const mockMatchProductForWorkflow = vi.fn().mockResolvedValue("prod-1");
vi.mock("./workflow-product-match", () => ({
  matchProductForWorkflow: (...args: unknown[]) => mockMatchProductForWorkflow(...args),
}));

let telegramStateStore: Record<string, Record<string, unknown>> = {};

vi.mock("@/lib/db/telegram-state", () => ({
  getTelegramState: vi.fn((uid: string) =>
    Promise.resolve(telegramStateStore[uid] ?? { phase: "idle", updatedAt: Date.now() }),
  ),
  setTelegramState: vi.fn((uid: string, state: Record<string, unknown>) => {
    telegramStateStore[uid] = { ...(telegramStateStore[uid] ?? {}), ...state };
    return Promise.resolve();
  }),
  resetTelegramState: vi.fn((uid: string) => {
    telegramStateStore[uid] = { phase: "idle", updatedAt: Date.now() };
    return Promise.resolve();
  }),
}));

vi.mock("@/lib/db/workflows", () => ({
  createWorkflow: vi.fn().mockResolvedValue("wf-test-123"),
  getWorkflow: vi.fn().mockResolvedValue({
    id: "wf-test-123",
    name: "Test Workflow",
    description: "Test description",
    status: "planned",
    globalSettings: { productId: "prod-1" },
  }),
  getWorkflowSteps: vi.fn().mockResolvedValue([
    {
      id: "s1",
      index: 0,
      type: "image",
      title: "Hero Shot",
      description: "Main product image",
      promptConfig: { workflowType: "MAIN_IMAGE" },
      status: "planned",
    },
    {
      id: "s2",
      index: 1,
      type: "image",
      title: "Lifestyle Shot",
      description: "Product in use",
      promptConfig: { workflowType: "LIFESTYLE", poseDescription: "Seated" },
      status: "planned",
    },
  ]),
  setWorkflowSteps: vi.fn().mockResolvedValue(undefined),
  updateWorkflow: vi.fn().mockResolvedValue(undefined),
  updateWorkflowStep: vi.fn().mockResolvedValue(undefined),
  replaceWorkflowStep: vi.fn().mockResolvedValue(undefined),
  listWorkflows: vi.fn().mockResolvedValue([
    { id: "wf-1", name: "My Workflow", status: "completed", description: "Test" },
  ]),
}));

vi.mock("@/lib/db/human-models", () => ({
  listHumanModels: vi.fn().mockResolvedValue([
    { id: "model-1", displayName: "Anna" },
    { id: "model-2", displayName: "Maria" },
  ]),
  getHumanModel: vi.fn().mockResolvedValue({ id: "model-1", displayName: "Anna" }),
  listHumanModelIds: vi.fn().mockResolvedValue(["model-1", "model-2"]),
}));

vi.mock("@/lib/db/backgrounds", () => ({
  listBackgrounds: vi.fn().mockResolvedValue([
    { id: "bg-1", name: "Studio Weiß" },
    { id: "bg-2", name: "Outdoor Park" },
  ]),
  getBackground: vi.fn().mockResolvedValue({ id: "bg-1", name: "Studio Weiß" }),
}));

vi.mock("@/lib/db/products", () => ({
  listProducts: vi.fn().mockResolvedValue([
    { id: "prod-1", name: "Pilates Ball", category: "fitness" },
  ]),
  getProduct: vi.fn().mockResolvedValue({
    id: "prod-1",
    name: "Pilates Ball",
    category: "fitness",
  }),
}));

vi.mock("@/lib/billing/quota", () => ({
  checkQuota: vi.fn().mockResolvedValue({
    allowed: true,
    used: 5,
    limit: 100,
    remaining: 95,
  }),
  consumeCredit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@fashionmentum/workflow-core", () => ({
  planWorkflow: vi.fn().mockResolvedValue([
    {
      index: 0,
      type: "image",
      title: "Hero Shot",
      description: "Main product image",
      promptConfig: { workflowType: "MAIN_IMAGE" },
    },
    {
      index: 1,
      type: "image",
      title: "Lifestyle Shot",
      description: "Product in use",
      promptConfig: { workflowType: "LIFESTYLE" },
    },
  ]),
  replanStep: vi.fn().mockResolvedValue({
    index: 0,
    type: "image",
    title: "New Hero Shot",
    description: "Fresh approach to main product image",
    promptConfig: { workflowType: "MAIN_IMAGE" },
  }),
  startImageJob: vi.fn().mockResolvedValue({ jobId: "job-123" }),
  getJob: vi.fn().mockResolvedValue({
    jobId: "job-123",
    images: [{ filePath: "generated/prod-1/job-123/neutral/image.png" }],
  }),
  readWorkflowDataFile: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
  isAllowedGeminiImageModel: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/generation/gemini-text", () => ({
  generateText: vi.fn().mockResolvedValue("[Generated listing copy]"),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER: UserDoc = {
  uid: "u1",
  email: "test@test.com",
  displayName: "Tester",
  photoURL: null,
  workspaceId: "ws1",
  preferredLocale: "de",
} as UserDoc;

function makeCQ(data: string, messageText = ""): TelegramCallbackQuery {
  return {
    id: "cq-1",
    from: { id: 123, is_bot: false, first_name: "Test" },
    message: {
      message_id: 10,
      chat: { id: 123, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: messageText,
    },
    data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("workflow-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telegramStateStore = {};
    process.env.NEXT_PUBLIC_APP_URL = "https://gripshot.test";
    mockMatchProductForWorkflow.mockResolvedValue("prod-1");
  });

  describe("startWorkflowCreation — sequential settings", () => {
    it("sends workflow title then product confirmation when a match is suggested", async () => {
      const { startWorkflowCreation } = await import("./workflow-handler");

      await startWorkflowCreation(
        123,
        TEST_USER,
        "10 Pilates-Übungen mit Miniball für einen Flyer",
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(2);

      expect(mockSendMessage).toHaveBeenNthCalledWith(
        1,
        123,
        expect.stringContaining("Neuer Workflow"),
        expect.objectContaining({ parseMode: "Markdown" }),
      );

      expect(mockSendMessage).toHaveBeenNthCalledWith(
        2,
        123,
        expect.stringMatching(/Produkt|Pilates Ball|schlage vor|I'll use/i),
        expect.objectContaining({
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "wf_product_ok" }),
                expect.objectContaining({ callback_data: "wf_product_other" }),
              ]),
            ]),
          }),
        }),
      );

      const state = telegramStateStore["u1"];
      expect(state.phase).toBe("awaiting_settings");
      expect(state.settingsStep).toBe("confirm_product");
      expect(state.workflowSuggestedProductId).toBe("prod-1");
      expect(state.pendingDescription).toContain("Pilates");
    });

    it("shows product picker when matcher returns no suggestion", async () => {
      mockMatchProductForWorkflow.mockResolvedValueOnce(null);
      const { startWorkflowCreation } = await import("./workflow-handler");
      await startWorkflowCreation(123, TEST_USER, "Generic campaign");

      const productMsg = mockSendMessage.mock.calls[1];
      const keyboard = productMsg[2].replyMarkup;
      const allButtons = keyboard.inline_keyboard.flat();
      expect(allButtons.some((b: { callback_data: string }) => b.callback_data?.startsWith("wf_prodset:"))).toBe(
        true,
      );
    });

    it("resets state when workspace has no products", async () => {
      const { listProducts } = await import("@/lib/db/products");
      vi.mocked(listProducts).mockResolvedValueOnce([]);

      const { startWorkflowCreation } = await import("./workflow-handler");
      await startWorkflowCreation(123, TEST_USER, "Test workflow");

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringMatching(/kein Produkt|don't have a product/i),
      );
      expect(telegramStateStore["u1"].phase).toBe("idle");
    });

    it("after product confirm, model selection includes workspace models and None option", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "confirm_product",
        pendingDescription: "Test",
        pendingSettings: {},
        workflowSuggestedProductId: "prod-1",
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      await handleWorkflowCallback(makeCQ("wf_product_ok"), TEST_USER);

      const modelCall = mockSendMessage.mock.calls.find(
        (c: unknown[]) => typeof c[1] === "string" && (c[1] as string).includes("Model"),
      );
      expect(modelCall).toBeDefined();
      const keyboard = modelCall![2].replyMarkup;
      const allButtons = keyboard.inline_keyboard.flat();

      expect(allButtons.some((b: { text: string }) => b.text === "Anna")).toBe(true);
      expect(allButtons.some((b: { text: string }) => b.text === "Maria")).toBe(true);
      expect(allButtons.some((b: { text: string }) => b.text.includes("Keins"))).toBe(true);
      const pendingSettings = telegramStateStore["u1"].pendingSettings as
        | { productId?: string }
        | undefined;
      expect(pendingSettings?.productId).toBe("prod-1");
      expect(telegramStateStore["u1"].settingsStep).toBe("select_model");
    });
  });

  describe("handleWorkflowCallback — sequential settings flow", () => {
    it("model select → advances to background step", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "select_model",
        pendingDescription: "Test",
        pendingSettings: {},
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_model:model-1"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq-1", "Model gewählt ✓");
      expect(mockEditMessageReplyMarkup).toHaveBeenCalledWith(123, 10);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Hintergrund"),
        expect.objectContaining({ replyMarkup: expect.any(Object) }),
      );

      expect(telegramStateStore["u1"].settingsStep).toBe("select_background");
    });

    it("background select → advances to language step", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "select_background",
        pendingDescription: "Test",
        pendingSettings: { modelId: "model-1" },
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_bg:bg-1"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq-1", "Hintergrund gewählt ✓");

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Sprache"),
        expect.objectContaining({ replyMarkup: expect.any(Object) }),
      );

      expect(telegramStateStore["u1"].settingsStep).toBe("select_language");
    });

    it("language select → shows summary with confirm + change", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "select_language",
        pendingDescription: "Test Workflow",
        pendingSettings: { modelId: "model-1", backgroundId: "bg-1" },
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_lang:de"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        "cq-1",
        "Sprache: Deutsch ✓",
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Zusammenfassung"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: "✅ Los" }),
                expect.objectContaining({ text: "✏️ Ändern" }),
              ]),
            ]),
          }),
        }),
      );

      expect(telegramStateStore["u1"].settingsStep).toBe("confirm");
    });

    it("change button → restarts from model selection but keeps product", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "confirm",
        pendingDescription: "Test",
        pendingSettings: {
          productId: "prod-1",
          modelId: "model-1",
          backgroundId: "bg-1",
          language: "de",
        },
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_change"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].settingsStep).toBe("select_model");
      expect(telegramStateStore["u1"].pendingSettings).toEqual({ productId: "prod-1" });
    });
  });

  describe("handleWorkflowCallback — confirm & plan", () => {
    it("creates workflow, runs planner, and sends plan for review", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "confirm",
        pendingDescription: "10 Pilates-Übungen für Flyer",
        pendingSettings: { productId: "prod-1", language: "de" },
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_confirm"), TEST_USER);

      expect(handled).toBe(true);

      const { createWorkflow } = await import("@/lib/db/workflows");
      expect(createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          workspaceId: "ws1",
          description: "10 Pilates-Übungen für Flyer",
          globalSettings: expect.objectContaining({ productId: "prod-1" }),
        }),
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("plane Schritte"),
      );

      const stepMessages = mockSendMessage.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === "string" && (c[1] as string).includes("Schritt"),
      );
      expect(stepMessages.length).toBeGreaterThanOrEqual(2);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Plan fertig"),
        expect.objectContaining({
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: "▶ Alle generieren" }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe("handleWorkflowCallback — step review", () => {
    it("approves a step by removing buttons", async () => {
      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_step_ok:0"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq-1", "Schritt 1 bestätigt ✓");
      expect(mockEditMessageReplyMarkup).toHaveBeenCalledWith(123, 10);
    });

    it("replans a step and updates the message", async () => {
      telegramStateStore["u1"] = {
        phase: "reviewing_plan",
        activeWorkflowId: "wf-test-123",
        pendingDescription: "Test",
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_step_replan:0"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq-1", "Plane Schritt neu …");
      expect(mockEditMessageText).toHaveBeenCalledWith(
        123,
        10,
        expect.stringContaining("New Hero Shot"),
        expect.objectContaining({ parseMode: "Markdown" }),
      );
    });
  });

  describe("handleWorkflowCallback — post-generation navigation", () => {
    it("handles keep result by removing buttons", async () => {
      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_keep:0"), TEST_USER);

      expect(handled).toBe(true);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq-1", "Schritt 1 behalten ✓");
      expect(mockEditMessageReplyMarkup).toHaveBeenCalledWith(123, 10);
    });

    it("handles back to overview", async () => {
      telegramStateStore["u1"] = {
        phase: "generating",
        activeWorkflowId: "wf-test-123",
      };

      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_overview"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].phase).toBe("reviewing_plan");

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Plan fertig"),
        expect.any(Object),
      );
    });
  });

  describe("handleWorkflowCallback — unknown prefix", () => {
    it("returns false for non-workflow callbacks", async () => {
      const { handleWorkflowCallback } = await import("./workflow-handler");
      const handled = await handleWorkflowCallback(makeCQ("wf_unknown:foo"), TEST_USER);

      expect(handled).toBe(false);
    });
  });

  describe("sendWorkflowList", () => {
    it("sends workflow list with step progress and deep links", async () => {
      const { sendWorkflowList } = await import("./workflow-handler");
      await sendWorkflowList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Workflows"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  url: expect.stringContaining("workflows/wf-1"),
                }),
              ]),
            ]),
          }),
        }),
      );

      const text = mockSendMessage.mock.calls[0][1] as string;
      expect(text).toContain("0/2");
    });
  });

  describe("promptNewWorkflow", () => {
    it("sets state and sends description prompt", async () => {
      const { promptNewWorkflow } = await import("./workflow-handler");
      await promptNewWorkflow(123, TEST_USER);

      expect(telegramStateStore["u1"].phase).toBe("awaiting_settings");
      expect(telegramStateStore["u1"].settingsStep).toBe("awaiting_description");

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Beschreibe"),
      );
    });
  });

  describe("handleWorkflowDescriptionFreetext", () => {
    it("consumes text when awaiting description and starts creation", async () => {
      telegramStateStore["u1"] = {
        phase: "awaiting_settings",
        settingsStep: "awaiting_description",
        pendingSettings: {},
      };

      const { handleWorkflowDescriptionFreetext } = await import("./workflow-handler");
      const consumed = await handleWorkflowDescriptionFreetext(
        123,
        TEST_USER,
        "10 Fitness-Bilder für einen Flyer",
      );

      expect(consumed).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Neuer Workflow"),
        expect.objectContaining({ parseMode: "Markdown" }),
      );
    });

    it("returns false when not awaiting description", async () => {
      telegramStateStore["u1"] = { phase: "idle", updatedAt: Date.now() };

      const { handleWorkflowDescriptionFreetext } = await import("./workflow-handler");
      const consumed = await handleWorkflowDescriptionFreetext(123, TEST_USER, "Some text");

      expect(consumed).toBe(false);
    });
  });

  describe("generation — resume after failure", () => {
    it("sets reviewing_plan and sends resume keyboard when image step throws", async () => {
      telegramStateStore["u1"] = {
        phase: "reviewing_plan",
        activeWorkflowId: "wf-test-123",
      };

      const core = await import("@fashionmentum/workflow-core");
      vi.mocked(core.startImageJob).mockRejectedValueOnce(new Error("API timeout"));

      const { handleWorkflowCallback } = await import("./workflow-handler");
      await handleWorkflowCallback(makeCQ("wf_gen:0"), TEST_USER);

      expect(telegramStateStore["u1"].phase).toBe("reviewing_plan");
      expect(telegramStateStore["u1"].activeStepIndex).toBeUndefined();

      expect(
        mockSendMessage.mock.calls.some(
          (c: unknown[]) =>
            typeof c[1] === "string" && (c[1] as string).includes("Weiter im Workflow"),
        ),
      ).toBe(true);

      const hasGenAll = mockSendMessage.mock.calls.some((c: unknown[]) => {
        const rows = (c[2] as { replyMarkup?: { inline_keyboard?: unknown[] } } | undefined)
          ?.replyMarkup?.inline_keyboard;
        if (!Array.isArray(rows)) return false;
        return rows.some((row) =>
          Array.isArray(row) &&
          row.some((b: { callback_data?: string }) => b?.callback_data === "wf_gen_all"),
        );
      });
      expect(hasGenAll).toBe(true);
    });
  });
});
