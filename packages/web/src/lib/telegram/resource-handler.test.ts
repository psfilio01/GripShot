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
const mockEditMessageReplyMarkup = vi.fn();
const mockAnswerCallbackQuery = vi.fn();

vi.mock("./client", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  editMessageReplyMarkup: (...args: unknown[]) => mockEditMessageReplyMarkup(...args),
  answerCallbackQuery: (...args: unknown[]) => mockAnswerCallbackQuery(...args),
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

vi.mock("@/lib/db/human-models", () => ({
  createHumanModel: vi.fn().mockResolvedValue("model-new-1"),
  listHumanModels: vi.fn().mockResolvedValue([
    { id: "m1", displayName: "Anna", source: "human" },
    { id: "m2", displayName: "KI Model", source: "ai" },
  ]),
}));

vi.mock("@/lib/db/backgrounds", () => ({
  createBackground: vi.fn().mockResolvedValue("bg-new-1"),
  listBackgrounds: vi.fn().mockResolvedValue([
    { id: "bg1", name: "Studio", type: "freestyle" },
  ]),
}));

vi.mock("@/lib/db/products", () => ({
  createProduct: vi.fn().mockResolvedValue("prod-new-1"),
  listProducts: vi.fn().mockResolvedValue([
    { id: "p1", name: "Yoga Mat", category: "fitness", status: "active" },
    { id: "p2", name: "Miniball", category: "fitness", status: "active" },
  ]),
}));

vi.mock("@/lib/db/brands", () => ({
  createBrand: vi.fn().mockResolvedValue("brand-new-1"),
  listBrands: vi.fn().mockResolvedValue([
    { id: "brand-1", name: "TestBrand" },
  ]),
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

function makeCQ(data: string): TelegramCallbackQuery {
  return {
    id: "cq-1",
    from: { id: 123, is_bot: false, first_name: "Test" },
    message: {
      message_id: 10,
      chat: { id: 123, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: "",
    },
    data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resource-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telegramStateStore = {};
    process.env.NEXT_PUBLIC_APP_URL = "https://gripshot.test";
  });

  describe("model creation flow", () => {
    it("startModelCreation shows type selection", async () => {
      const { startModelCreation } = await import("./resource-handler");
      await startModelCreation(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Model"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "res_model_type:human" }),
                expect.objectContaining({ callback_data: "res_model_type:ai" }),
              ]),
            ]),
          }),
        }),
      );

      expect(telegramStateStore["u1"].phase).toBe("creating_model");
      expect(telegramStateStore["u1"].resourceStep).toBe("type");
    });

    it("type callback advances to name step", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_model",
        resourceStep: "type",
        pendingResource: {},
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_model_type:ai"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("name");
      expect(telegramStateStore["u1"].pendingResource).toEqual(
        expect.objectContaining({ source: "ai" }),
      );
    });

    it("name freetext for AI model advances to freetext prompt", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_model",
        resourceStep: "name",
        pendingResource: { source: "ai" },
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "Test Model");

      expect(consumed).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("freetext");
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Aussehen"),
      );
    });

    it("name freetext for human model advances to notes", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_model",
        resourceStep: "name",
        pendingResource: { source: "human" },
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "My Model");

      expect(consumed).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("notes");
    });

    it("gender callback advances to age step", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_model",
        resourceStep: "gender",
        pendingResource: { source: "ai", displayName: "Test", aiPrompt: "desc" },
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_model_gender:female"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("age");
      expect(telegramStateStore["u1"].pendingResource).toEqual(
        expect.objectContaining({ gender: "female" }),
      );
    });

    it("hair callback finalizes model creation", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_model",
        resourceStep: "hair",
        pendingResource: {
          source: "ai",
          displayName: "Test AI Model",
          aiPrompt: "Athletic woman",
          gender: "female",
          ageRange: "25-35",
          bodyBuild: "athletic",
        },
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_model_hair:long"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].phase).toBe("idle");

      const { createHumanModel } = await import("@/lib/db/human-models");
      expect(createHumanModel).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws1",
          displayName: "Test AI Model",
          source: "ai",
          aiPrompt: "Athletic woman",
        }),
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Test AI Model"),
        expect.objectContaining({ parseMode: "Markdown" }),
      );
    });
  });

  describe("background creation flow", () => {
    it("startBackgroundCreation shows type selection", async () => {
      const { startBackgroundCreation } = await import("./resource-handler");
      await startBackgroundCreation(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Hintergrund"),
        expect.objectContaining({
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: "res_bg_type:canvas" }),
                expect.objectContaining({ callback_data: "res_bg_type:freestyle" }),
                expect.objectContaining({ callback_data: "res_bg_type:upload" }),
              ]),
            ]),
          }),
        }),
      );
    });

    it("type callback advances to name", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_background",
        resourceStep: "type",
        pendingResource: {},
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_bg_type:canvas"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("name");
    });

    it("full freestyle flow creates background", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_background",
        resourceStep: "description",
        pendingResource: { type: "freestyle", name: "Test BG" },
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "A minimalist studio");

      expect(consumed).toBe(true);
      expect(telegramStateStore["u1"].phase).toBe("idle");

      const { createBackground } = await import("@/lib/db/backgrounds");
      expect(createBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws1",
          name: "Test BG",
          type: "freestyle",
          description: "A minimalist studio",
        }),
      );
    });
  });

  describe("product creation flow", () => {
    it("startProductCreation sets phase and asks for name", async () => {
      const { startProductCreation } = await import("./resource-handler");
      await startProductCreation(123, TEST_USER);

      expect(telegramStateStore["u1"].phase).toBe("creating_product");
      expect(telegramStateStore["u1"].resourceStep).toBe("name");
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Produkt"),
        expect.any(Object),
      );
    });

    it("name freetext advances to brand selection", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_product",
        resourceStep: "name",
        pendingResource: {},
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "Yoga Mat");

      expect(consumed).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("brand");
      expect(telegramStateStore["u1"].pendingResource).toEqual(
        expect.objectContaining({ name: "Yoga Mat" }),
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Marke"),
        expect.objectContaining({ replyMarkup: expect.any(Object) }),
      );
    });

    it("brand callback advances to category", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_product",
        resourceStep: "brand",
        pendingResource: { name: "Yoga Mat" },
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_prod_brand:brand-1"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("category");
    });

    it("category callback advances to description", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_product",
        resourceStep: "category",
        pendingResource: { name: "Yoga Mat", brandId: "brand-1" },
      };

      const { handleResourceCallback } = await import("./resource-handler");
      const handled = await handleResourceCallback(makeCQ("res_prod_cat:fitness"), TEST_USER);

      expect(handled).toBe(true);
      expect(telegramStateStore["u1"].resourceStep).toBe("description");
    });

    it("description freetext finalizes product creation", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_product",
        resourceStep: "description",
        pendingResource: { name: "Yoga Mat", brandId: "brand-1", category: "fitness" },
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "A premium yoga mat");

      expect(consumed).toBe(true);
      expect(telegramStateStore["u1"].phase).toBe("idle");

      const { createProduct } = await import("@/lib/db/products");
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws1",
          brandId: "brand-1",
          name: "Yoga Mat",
          category: "fitness",
          description: "A premium yoga mat",
        }),
      );
    });

    it("skip description creates product without description", async () => {
      telegramStateStore["u1"] = {
        phase: "creating_product",
        resourceStep: "description",
        pendingResource: { name: "Ball", brandId: "brand-1", category: "fitness" },
      };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "skip");

      expect(consumed).toBe(true);

      const { createProduct } = await import("@/lib/db/products");
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ description: "" }),
      );
    });
  });

  describe("handleResourceFreetext — no active flow", () => {
    it("returns false when phase is idle", async () => {
      telegramStateStore["u1"] = { phase: "idle", updatedAt: Date.now() };

      const { handleResourceFreetext } = await import("./resource-handler");
      const consumed = await handleResourceFreetext(123, TEST_USER, "Some text");

      expect(consumed).toBe(false);
    });
  });

  describe("sendProductList", () => {
    it("lists products with deep links", async () => {
      const { sendProductList } = await import("./resource-handler");
      await sendProductList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Produkte"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: expect.stringContaining("Yoga Mat") }),
              ]),
            ]),
          }),
        }),
      );
    });

    it("shows empty message when no products", async () => {
      const { listProducts } = await import("@/lib/db/products");
      (listProducts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const { sendProductList } = await import("./resource-handler");
      await sendProductList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("keine Produkte"),
      );
    });
  });

  describe("sendModelList", () => {
    it("lists models with deep links", async () => {
      const { sendModelList } = await import("./resource-handler");
      await sendModelList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Models"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining("Anna"),
                  url: expect.stringContaining("https://gripshot.test/de/dashboard/human-models/m1"),
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it("on localhost omits url buttons and appends plain dashboard links", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      const { sendModelList } = await import("./resource-handler");
      await sendModelList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringMatching(/localhost.*human-models\/m1/s),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: undefined,
        }),
      );
    });

    it("shows empty message when no models", async () => {
      const { listHumanModels } = await import("@/lib/db/human-models");
      (listHumanModels as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const { sendModelList } = await import("./resource-handler");
      await sendModelList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("keine Models"),
      );
    });
  });

  describe("sendBackgroundList", () => {
    it("lists backgrounds with deep links", async () => {
      const { sendBackgroundList } = await import("./resource-handler");
      await sendBackgroundList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Hintergründe"),
        expect.objectContaining({
          parseMode: "Markdown",
          replyMarkup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: expect.stringContaining("Studio") }),
              ]),
            ]),
          }),
        }),
      );
    });

    it("shows empty message when no backgrounds", async () => {
      const { listBackgrounds } = await import("@/lib/db/backgrounds");
      (listBackgrounds as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const { sendBackgroundList } = await import("./resource-handler");
      await sendBackgroundList(123, TEST_USER);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("keine Hintergründe"),
      );
    });
  });
});
