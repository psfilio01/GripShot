import { createLogger } from "@/lib/logger";
import {
  getUserByTelegramChatId,
  createTelegramLinkToken,
} from "@/lib/db/telegram";
import { getWorkspace } from "@/lib/db/users";
import { getTelegramState, resetTelegramState } from "@/lib/db/telegram-state";
import { checkQuota } from "@/lib/billing/quota";
import { listProducts, listDeletedProducts } from "@/lib/db/products";
import { listHumanModels, listDeletedHumanModels } from "@/lib/db/human-models";
import { listBackgrounds, listDeletedBackgrounds } from "@/lib/db/backgrounds";
import { listDeletedWorkflows } from "@/lib/db/workflows";
import {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  editMessageReplyMarkup,
} from "./client";
import { t, resolveLocale } from "./bot-messages";
import { transcribeVoiceMessage } from "./voice";
import { classifyIntent } from "./intent-classifier";
import {
  startWorkflowCreation,
  handleWorkflowCallback,
  sendWorkflowList,
  promptNewWorkflow,
  handleWorkflowDescriptionFreetext,
} from "./workflow-handler";
import {
  handleResourceCallback,
  handleResourceFreetext,
  startModelCreation,
  startBackgroundCreation,
  startProductCreation,
  sendProductList,
  sendModelList,
  sendBackgroundList,
} from "./resource-handler";
import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramInlineKeyboardMarkup,
  BotLocale,
} from "./types";
import type { UserDoc } from "@/lib/db/types";
import { getTelegramAppBaseUrl } from "./app-url";

const log = createLogger("telegram:handlers");

/** Top-level dispatcher — called by the webhook route. */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    log.error("Failed to handle update", {
      updateId: update.update_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

async function handleMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;

  if (msg.voice || msg.audio) {
    await handleVoiceMessage(msg);
    return;
  }

  const text = msg.text?.trim() ?? "";
  const command = parseCommand(text);

  switch (command) {
    case "/start":
      await handleStart(chatId);
      break;
    case "/status":
      await handleStatus(chatId);
      break;
    case "/help":
      await handleHelp(chatId);
      break;
    case "/dashboard":
      await handleDashboard(chatId);
      break;
    case "/settings":
      await handleSettings(chatId);
      break;
    case "/workflows":
      await handleWorkflows(chatId);
      break;
    case "/newworkflow":
      await handleNewWorkflow(chatId);
      break;
    case "/products":
      await handleProducts(chatId);
      break;
    case "/models":
      await handleModels(chatId);
      break;
    case "/backgrounds":
      await handleBackgrounds(chatId);
      break;
    case "/newmodel":
      await handleNewModel(chatId);
      break;
    case "/newbackground":
      await handleNewBackground(chatId);
      break;
    case "/newproduct":
      await handleNewProduct(chatId);
      break;
    case "/cancel":
      await handleCancel(chatId);
      break;
    case "/trash":
      await handleTrash(chatId);
      break;
    default:
      await handleFreetext(chatId, text);
  }
}

/** Extract the leading /command from message text (ignoring @botname suffixes). */
export function parseCommand(text: string): string | null {
  const match = text.match(/^\/([a-zA-Z0-9_]+)(@\S+)?/);
  return match ? `/${match[1].toLowerCase()}` : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUser(chatId: number): Promise<{ user: UserDoc; locale: BotLocale } | null> {
  const user = await getUserByTelegramChatId(chatId);
  if (!user) return null;
  return { user, locale: resolveLocale(user.preferredLocale) };
}

async function requireLinkedUser(chatId: number): Promise<{ user: UserDoc; locale: BotLocale } | null> {
  const result = await resolveUser(chatId);
  if (!result) {
    await sendNotLinkedMessage(chatId);
    return null;
  }
  return result;
}

// ---------------------------------------------------------------------------
// /start
// ---------------------------------------------------------------------------

async function handleStart(chatId: number): Promise<void> {
  const resolved = await resolveUser(chatId);

  if (resolved) {
    const { user, locale } = resolved;
    const name = user.displayName ?? user.email;
    await sendMessage(chatId, t("welcome_back", locale, { name }));
    return;
  }

  const token = await createTelegramLinkToken(chatId);
  const linkUrl = `${getTelegramAppBaseUrl()}/en/dashboard/settings/telegram?token=${token}`;
  await sendMessage(chatId, t("welcome_new", "de", { url: linkUrl }));
}

// ---------------------------------------------------------------------------
// /status
// ---------------------------------------------------------------------------

async function handleStatus(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { user, locale } = resolved;

  const workspace = await getWorkspace(user.workspaceId);
  if (!workspace) {
    await sendMessage(chatId, t("workspace_not_found", locale));
    return;
  }

  const [quota, products, models, backgrounds] = await Promise.all([
    checkQuota(user.workspaceId),
    listProducts(user.workspaceId),
    listHumanModels(user.workspaceId),
    listBackgrounds(user.workspaceId),
  ]);
  const planLabel = { free: "Free", starter: "Starter", pro: "Pro" }[workspace.plan] ?? workspace.plan;

  await sendMessage(
    chatId,
    t("status_title", locale, {
      plan: planLabel,
      remaining: quota.remaining,
      limit: quota.limit,
      used: quota.used,
      products: products.length,
      models: models.length,
      backgrounds: backgrounds.length,
    }),
    { parseMode: "Markdown" },
  );
}

// ---------------------------------------------------------------------------
// /help
// ---------------------------------------------------------------------------

async function handleHelp(chatId: number): Promise<void> {
  const resolved = await resolveUser(chatId);
  const locale = resolved?.locale ?? "de";
  await sendMessage(chatId, t("help", locale), { parseMode: "Markdown" });
}

// ---------------------------------------------------------------------------
// /dashboard — deep link
// ---------------------------------------------------------------------------

async function handleDashboard(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { locale } = resolved;

  const url = `${getTelegramAppBaseUrl()}/${locale}/dashboard`;
  await sendMessage(chatId, t("dashboard_link", locale, { url }));
}

// ---------------------------------------------------------------------------
// /settings — deep link to settings
// ---------------------------------------------------------------------------

async function handleSettings(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { locale } = resolved;

  const url = `${getTelegramAppBaseUrl()}/${locale}/dashboard/settings`;
  await sendMessage(chatId, t("settings_link", locale, { url }));
}

// ---------------------------------------------------------------------------
// /workflows — list workflows with deep links
// ---------------------------------------------------------------------------

async function handleWorkflows(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await sendWorkflowList(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /newworkflow — explicit workflow creation entry point
// ---------------------------------------------------------------------------

async function handleNewWorkflow(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await promptNewWorkflow(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /products — list products
// ---------------------------------------------------------------------------

async function handleProducts(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await sendProductList(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /models — list models
// ---------------------------------------------------------------------------

async function handleModels(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await sendModelList(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /backgrounds — list backgrounds
// ---------------------------------------------------------------------------

async function handleBackgrounds(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await sendBackgroundList(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /newmodel
// ---------------------------------------------------------------------------

async function handleNewModel(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await startModelCreation(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /newbackground
// ---------------------------------------------------------------------------

async function handleNewBackground(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await startBackgroundCreation(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /newproduct
// ---------------------------------------------------------------------------

async function handleNewProduct(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  await startProductCreation(chatId, resolved.user);
}

// ---------------------------------------------------------------------------
// /trash
// ---------------------------------------------------------------------------

async function handleTrash(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { user, locale } = resolved;

  const [workflows, products, models, backgrounds] = await Promise.all([
    listDeletedWorkflows(user.workspaceId),
    listDeletedProducts(user.workspaceId),
    listDeletedHumanModels(user.workspaceId),
    listDeletedBackgrounds(user.workspaceId),
  ]);

  const total = workflows.length + products.length + models.length + backgrounds.length;
  const url = `${getTelegramAppBaseUrl()}/${locale}/dashboard/trash`;

  await sendMessage(
    chatId,
    t("trash_status", locale, {
      total: String(total),
      workflows: String(workflows.length),
      products: String(products.length),
      models: String(models.length),
      backgrounds: String(backgrounds.length),
      url,
    }),
    { parseMode: "Markdown" },
  );
}

// ---------------------------------------------------------------------------
// /cancel
// ---------------------------------------------------------------------------

async function handleCancel(chatId: number): Promise<void> {
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { user, locale } = resolved;

  await resetTelegramState(user.uid);
  await sendMessage(chatId, t("flow_cancelled", locale));
}

// ---------------------------------------------------------------------------
// Voice messages
// ---------------------------------------------------------------------------

async function handleVoiceMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { locale } = resolved;

  const fileId = msg.voice?.file_id ?? msg.audio?.file_id;
  if (!fileId) {
    await sendMessage(chatId, t("voice_no_file", locale));
    return;
  }

  await sendMessage(chatId, t("voice_transcribing", locale));

  let transcription: string;
  try {
    transcription = await transcribeVoiceMessage(fileId);
  } catch (err) {
    log.error("Voice transcription failed", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("voice_transcription_failed", locale));
    return;
  }

  const confirmKeyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: t("voice_confirm_btn", locale), callback_data: `voice_confirm:${msg.message_id}` },
        { text: t("voice_edit_btn", locale), callback_data: `voice_edit:${msg.message_id}` },
        { text: t("voice_cancel_btn", locale), callback_data: `voice_cancel:${msg.message_id}` },
      ],
    ],
  };

  await sendMessage(
    chatId,
    t("voice_result", locale, { text: transcription }),
    { parseMode: "Markdown", replyMarkup: confirmKeyboard },
  );
}

// ---------------------------------------------------------------------------
// Freetext → state-aware routing → intent classification → action
// ---------------------------------------------------------------------------

async function handleFreetext(chatId: number, text: string): Promise<void> {
  if (!text) {
    await sendMessage(chatId, t("unknown_command", "de"));
    return;
  }

  const resolved = await requireLinkedUser(chatId);
  if (!resolved) return;
  const { user, locale } = resolved;

  const consumedByWorkflow = await handleWorkflowDescriptionFreetext(chatId, user, text);
  if (consumedByWorkflow) return;

  const consumed = await handleResourceFreetext(chatId, user, text);
  if (consumed) return;

  try {
    const classification = await classifyIntent(text);
    log.info("Intent classified", { chatId, intent: classification.intent });

    switch (classification.intent) {
      case "create_workflow":
        await startWorkflowCreation(chatId, user, classification.description ?? text);
        break;
      case "create_model":
        await startModelCreation(chatId, user);
        break;
      case "create_background":
        await startBackgroundCreation(chatId, user);
        break;
      case "create_product":
        await startProductCreation(chatId, user);
        break;
      case "question":
        await sendMessage(chatId, t("intent_question", locale));
        break;
      case "feedback":
        await sendMessage(chatId, t("intent_feedback", locale));
        break;
      default:
        await sendMessage(chatId, t("intent_unclear", locale));
    }
  } catch (err) {
    log.error("Intent classification failed", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("processing_error", locale));
  }
}

// ---------------------------------------------------------------------------
// Callback queries (inline button presses)
// ---------------------------------------------------------------------------

async function handleCallbackQuery(cq: TelegramCallbackQuery): Promise<void> {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;

  if (!chatId || !messageId) {
    await answerCallbackQuery(cq.id);
    return;
  }

  const resolved = await resolveUser(chatId);
  const locale = resolved?.locale ?? "de";

  if (data.startsWith("wf_") && resolved) {
    const handled = await handleWorkflowCallback(cq, resolved.user);
    if (handled) return;
  }

  if (data.startsWith("res_") && resolved) {
    const handled = await handleResourceCallback(cq, resolved.user);
    if (handled) return;
  }

  await answerCallbackQuery(cq.id);

  if (data.startsWith("voice_confirm:")) {
    const voiceText = extractVoiceText(cq.message?.text);
    await editMessageText(
      chatId,
      messageId,
      `${cq.message?.text ?? ""}\n\n${t("voice_confirmed", locale)}`,
    );
    if (voiceText) {
      await handleFreetext(chatId, voiceText);
    }
    log.info("Voice command confirmed", { chatId, messageId });
  } else if (data.startsWith("voice_edit:")) {
    await editMessageText(
      chatId,
      messageId,
      `${cq.message?.text ?? ""}\n\n${t("voice_edit_prompt", locale)}`,
    );
  } else if (data.startsWith("voice_cancel:")) {
    await editMessageText(chatId, messageId, t("cancelled", locale));
  }
}

/**
 * Extract the user's transcribed text from a voice confirmation message.
 * Format: "🗣️ *Erkannter Text:*\n\n{transcription}" or "🗣️ *Recognized text:*\n\n{transcription}"
 */
function extractVoiceText(messageText?: string): string | null {
  if (!messageText) return null;
  for (const marker of ["Erkannter Text:", "Recognized text:"]) {
    const idx = messageText.indexOf(marker);
    if (idx !== -1) {
      return messageText.slice(idx + marker.length).trim().split("\n\n✅")[0].trim() || null;
    }
  }
  return null;
}

async function sendNotLinkedMessage(chatId: number): Promise<void> {
  await sendMessage(chatId, t("not_linked", "de"));
}
