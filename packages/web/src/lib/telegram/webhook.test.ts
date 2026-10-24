import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramUpdate, TelegramMessage } from "./types";

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
const mockAnswerCallbackQuery = vi.fn();
const mockEditMessageText = vi.fn();

vi.mock("./client", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  answerCallbackQuery: (...args: unknown[]) => mockAnswerCallbackQuery(...args),
  editMessageText: (...args: unknown[]) => mockEditMessageText(...args),
  getFile: vi.fn(),
  downloadFile: vi.fn(),
}));

const mockGetUserByTelegramChatId = vi.fn();
const mockCreateTelegramLinkToken = vi.fn();

vi.mock("@/lib/db/telegram", () => ({
  getUserByTelegramChatId: (...args: unknown[]) =>
    mockGetUserByTelegramChatId(...args),
  createTelegramLinkToken: (...args: unknown[]) =>
    mockCreateTelegramLinkToken(...args),
}));

vi.mock("@/lib/db/users", () => ({
  getWorkspace: vi.fn().mockResolvedValue({
    name: "Test WS",
    plan: "starter",
    quotaUsed: 10,
    quotaLimit: 500,
  }),
}));

vi.mock("@/lib/billing/quota", () => ({
  checkQuota: vi.fn().mockResolvedValue({
    allowed: true,
    used: 10,
    limit: 500,
    remaining: 490,
  }),
}));

vi.mock("./voice", () => ({
  transcribeVoiceMessage: vi.fn().mockResolvedValue("Transkribierter Text"),
}));

vi.mock("./intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue({ intent: "unknown" }),
}));

vi.mock("./workflow-handler", () => ({
  startWorkflowCreation: vi.fn().mockResolvedValue(undefined),
  handleWorkflowCallback: vi.fn().mockResolvedValue(false),
  sendWorkflowList: vi.fn().mockResolvedValue(undefined),
  promptNewWorkflow: vi.fn().mockResolvedValue(undefined),
  handleWorkflowDescriptionFreetext: vi.fn().mockResolvedValue(false),
}));

vi.mock("./resource-handler", () => ({
  handleResourceCallback: vi.fn().mockResolvedValue(false),
  handleResourceFreetext: vi.fn().mockResolvedValue(false),
  startModelCreation: vi.fn().mockResolvedValue(undefined),
  startBackgroundCreation: vi.fn().mockResolvedValue(undefined),
  startProductCreation: vi.fn().mockResolvedValue(undefined),
  sendProductList: vi.fn().mockResolvedValue(undefined),
  sendModelList: vi.fn().mockResolvedValue(undefined),
  sendBackgroundList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/products", () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/human-models", () => ({
  listHumanModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/backgrounds", () => ({
  listBackgrounds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/telegram-state", () => ({
  getTelegramState: vi.fn().mockResolvedValue({ phase: "idle", updatedAt: Date.now() }),
  setTelegramState: vi.fn().mockResolvedValue(undefined),
  resetTelegramState: vi.fn().mockResolvedValue(undefined),
}));

function makeTextMessage(text: string, chatId = 123): TelegramMessage {
  return {
    message_id: 1,
    chat: { id: chatId, type: "private" },
    from: { id: chatId, is_bot: false, first_name: "Test" },
    date: Math.floor(Date.now() / 1000),
    text,
  };
}

function makeUpdate(msg: TelegramMessage): TelegramUpdate {
  return { update_id: 1, message: msg };
}

describe("telegram webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("handles /start for unlinked user with linking token", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue(null);
    mockCreateTelegramLinkToken.mockResolvedValue("abc123");

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("/start")));

    expect(mockCreateTelegramLinkToken).toHaveBeenCalledWith(123);
    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("abc123"),
    );
  });

  it("handles /start for already-linked user with welcome back", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue({
      uid: "u1",
      email: "test@test.com",
      displayName: "Tester",
      workspaceId: "ws1",
    });

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("/start")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Willkommen zurück"),
    );
  });

  it("handles /status for linked user", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue({
      uid: "u1",
      email: "test@test.com",
      displayName: "Tester",
      workspaceId: "ws1",
    });

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("/status")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Status"),
      expect.objectContaining({ parseMode: "Markdown" }),
    );
  });

  it("handles /status for unlinked user", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue(null);

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("/status")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("nicht verknüpft"),
    );
  });

  it("handles /help", async () => {
    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("/help")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Hilfe"),
      expect.objectContaining({ parseMode: "Markdown" }),
    );
  });

  it("handles freetext from unlinked user with link prompt", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue(null);

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("hello world")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("nicht verknüpft"),
    );
  });

  it("handles freetext from linked user via intent classifier", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue({
      uid: "u1",
      email: "test@test.com",
      displayName: "Tester",
      workspaceId: "ws1",
    });

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("random text")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("nicht sicher, was du möchtest"),
    );
  });

  it("handles empty freetext as unknown command", async () => {
    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(makeTextMessage("")));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Unbekannter Befehl"),
    );
  });

  it("handles voice message for linked user", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue({
      uid: "u1",
      email: "test@test.com",
      displayName: "Tester",
      workspaceId: "ws1",
    });

    const msg = makeTextMessage("");
    msg.voice = {
      file_id: "file123",
      file_unique_id: "unique123",
      duration: 5,
    };
    delete msg.text;

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(msg));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Transkribiere"),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("Erkannter Text"),
      expect.objectContaining({
        parseMode: "Markdown",
        replyMarkup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: "✅ Ja, los" }),
            ]),
          ]),
        }),
      }),
    );
  });

  it("handles voice message for unlinked user", async () => {
    mockGetUserByTelegramChatId.mockResolvedValue(null);

    const msg = makeTextMessage("");
    msg.voice = {
      file_id: "file123",
      file_unique_id: "unique123",
      duration: 5,
    };
    delete msg.text;

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(makeUpdate(msg));

    expect(mockSendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining("nicht verknüpft"),
    );
  });

  it("handles callback query for voice confirmation", async () => {
    const update: TelegramUpdate = {
      update_id: 2,
      callback_query: {
        id: "cq1",
        from: { id: 123, is_bot: false, first_name: "Test" },
        message: {
          message_id: 10,
          chat: { id: 123, type: "private" },
          date: Math.floor(Date.now() / 1000),
          text: "Erkannter Text:\n\nHallo Welt",
        },
        data: "voice_confirm:1",
      },
    };

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(update);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq1");
    expect(mockEditMessageText).toHaveBeenCalledWith(
      123,
      10,
      expect.stringContaining("Bestätigt"),
    );
  });

  it("handles callback query for voice cancel", async () => {
    const update: TelegramUpdate = {
      update_id: 3,
      callback_query: {
        id: "cq2",
        from: { id: 123, is_bot: false, first_name: "Test" },
        message: {
          message_id: 11,
          chat: { id: 123, type: "private" },
          date: Math.floor(Date.now() / 1000),
          text: "Erkannter Text",
        },
        data: "voice_cancel:1",
      },
    };

    const { handleUpdate } = await import("./handlers");
    await handleUpdate(update);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cq2");
    expect(mockEditMessageText).toHaveBeenCalledWith(
      123,
      11,
      "❌ Abgebrochen.",
    );
  });
});
