import { createLogger } from "@/lib/logger";
import {
  sendMessage,
  sendPhoto,
  editMessageText,
  editMessageReplyMarkup,
  answerCallbackQuery,
} from "./client";
import { t, resolveLocale } from "./bot-messages";
import {
  getTelegramState,
  setTelegramState,
  resetTelegramState,
} from "@/lib/db/telegram-state";
import {
  createWorkflow,
  getWorkflow,
  getWorkflowSteps,
  setWorkflowSteps,
  updateWorkflow,
  updateWorkflowStep,
  replaceWorkflowStep,
  listWorkflows,
} from "@/lib/db/workflows";
import { listHumanModels, getHumanModel } from "@/lib/db/human-models";
import { listBackgrounds, getBackground } from "@/lib/db/backgrounds";
import { listProducts, getProduct } from "@/lib/db/products";
import { matchProductForWorkflow } from "./workflow-product-match";
import { checkQuota, consumeCredit } from "@/lib/billing/quota";
import { isAllowedGeminiImageModel } from "@fashionmentum/workflow-core";
import type { UserDoc } from "@/lib/db/types";
import type {
  TelegramInlineKeyboardMarkup,
  TelegramCallbackQuery,
  BotLocale,
} from "./types";
import {
  getTelegramAppBaseUrl,
  isTelegramInlineButtonUrlAllowed,
} from "./app-url";

const log = createLogger("telegram:workflow");

// ---------------------------------------------------------------------------
// Entry point: user sent freetext classified as "create_workflow"
// ---------------------------------------------------------------------------

export async function startWorkflowCreation(
  chatId: number,
  user: UserDoc,
  description: string,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);

  const products = await listProducts(user.workspaceId);
  if (products.length === 0) {
    await sendMessage(chatId, t("wf_no_products_workflow", locale));
    await resetTelegramState(user.uid);
    return;
  }

  let suggestedId: string | null = null;
  try {
    suggestedId = await matchProductForWorkflow(description, products);
  } catch (err) {
    log.warn("Product match failed; user will pick manually", {
      uid: user.uid,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const validSuggestion =
    suggestedId && products.some((p) => p.id === suggestedId) ? suggestedId : null;

  await setTelegramState(user.uid, {
    phase: "awaiting_settings",
    settingsStep: "confirm_product",
    pendingDescription: description,
    pendingSettings: {},
    activeWorkflowId: undefined,
    activeStepIndex: undefined,
    workflowSuggestedProductId: validSuggestion ?? undefined,
  });

  await sendMessage(
    chatId,
    t("wf_new_title", locale, { desc: description }),
    { parseMode: "Markdown" },
  );

  await sendWorkflowProductStep(chatId, user, locale, products, validSuggestion);
}

// ---------------------------------------------------------------------------
// Sequential settings: Step 0 — Product confirm / pick
// ---------------------------------------------------------------------------

function buildProductPickerKeyboard(
  products: { id: string; name: string }[],
): TelegramInlineKeyboardMarkup {
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const batch: { text: string; callback_data: string }[] = [];
  for (const p of products.slice(0, 8)) {
    batch.push({
      text: p.name.slice(0, 30),
      callback_data: `wf_prodset:${p.id}`,
    });
    if (batch.length === 3) {
      rows.push([...batch]);
      batch.length = 0;
    }
  }
  if (batch.length > 0) rows.push([...batch]);
  return { inline_keyboard: rows };
}

async function sendWorkflowProductStep(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
  products: { id: string; name: string }[],
  suggestedId: string | null,
): Promise<void> {
  if (suggestedId) {
    const p = products.find((x) => x.id === suggestedId);
    if (!p) {
      await sendMessage(chatId, t("wf_product_confirm_pick", locale), {
        parseMode: "Markdown",
        replyMarkup: buildProductPickerKeyboard(products),
      });
      return;
    }
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: t("wf_product_confirm_yes", locale), callback_data: "wf_product_ok" },
          { text: t("wf_product_confirm_other", locale), callback_data: "wf_product_other" },
        ],
      ],
    };
    await sendMessage(
      chatId,
      t("wf_product_confirm_suggested", locale, { name: escapeMarkdown(p.name) }),
      { parseMode: "Markdown", replyMarkup: keyboard },
    );
    return;
  }

  await sendMessage(chatId, t("wf_product_confirm_pick", locale), {
    parseMode: "Markdown",
    replyMarkup: buildProductPickerKeyboard(products),
  });
}

// ---------------------------------------------------------------------------
// Sequential settings: Step 1 — Model selection
// ---------------------------------------------------------------------------

async function sendModelSelection(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
): Promise<void> {
  const models = await listHumanModels(user.workspaceId);

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const batch: { text: string; callback_data: string }[] = [];
  for (const m of models.slice(0, 8)) {
    batch.push({ text: m.displayName, callback_data: `wf_model:${m.id}` });
    if (batch.length === 3) {
      rows.push([...batch]);
      batch.length = 0;
    }
  }
  if (batch.length > 0) rows.push([...batch]);
  rows.push([{ text: t("wf_no_model", locale), callback_data: "wf_model:none" }]);

  await sendMessage(chatId, t("wf_select_model", locale), {
    replyMarkup: { inline_keyboard: rows },
  });
}

// ---------------------------------------------------------------------------
// Sequential settings: Step 2 — Background selection
// ---------------------------------------------------------------------------

async function sendBackgroundSelection(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
): Promise<void> {
  const backgrounds = await listBackgrounds(user.workspaceId);

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const batch: { text: string; callback_data: string }[] = [];
  for (const bg of backgrounds.slice(0, 8)) {
    batch.push({ text: bg.name, callback_data: `wf_bg:${bg.id}` });
    if (batch.length === 3) {
      rows.push([...batch]);
      batch.length = 0;
    }
  }
  if (batch.length > 0) rows.push([...batch]);
  rows.push([{ text: t("wf_no_background", locale), callback_data: "wf_bg:none" }]);

  await sendMessage(chatId, t("wf_select_background", locale), {
    replyMarkup: { inline_keyboard: rows },
  });
}

// ---------------------------------------------------------------------------
// Sequential settings: Step 3 — Language selection
// ---------------------------------------------------------------------------

async function sendLanguageSelection(
  chatId: number,
  locale: BotLocale,
): Promise<void> {
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🇩🇪 Deutsch", callback_data: "wf_lang:de" },
        { text: "🇬🇧 English", callback_data: "wf_lang:en" },
      ],
    ],
  };
  await sendMessage(chatId, t("wf_select_language", locale), {
    replyMarkup: keyboard,
  });
}

// ---------------------------------------------------------------------------
// Sequential settings: Step 4 — Summary + Confirm / Change
// ---------------------------------------------------------------------------

async function sendSettingsSummary(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
): Promise<void> {
  const state = await getTelegramState(user.uid);
  const s = state.pendingSettings ?? {};

  const productName = s.productId
    ? (await getProduct(user.workspaceId, s.productId))?.name ?? s.productId
    : null;
  const modelName = s.modelId
    ? (await getHumanModel(user.workspaceId, s.modelId))?.displayName ?? s.modelId
    : null;
  const bgName = s.backgroundId
    ? (await getBackground(user.workspaceId, s.backgroundId))?.name ?? s.backgroundId
    : null;
  const langLabel = s.language === "en" ? "English" : "Deutsch";

  const settingsLines = [
    productName
      ? t("wf_summary_product", locale, { name: productName })
      : t("wf_summary_product_none", locale),
    modelName
      ? t("wf_summary_model", locale, { name: modelName })
      : t("wf_summary_model_none", locale),
    bgName
      ? t("wf_summary_bg", locale, { name: bgName })
      : t("wf_summary_bg_none", locale),
    t("wf_summary_lang", locale, { lang: langLabel }),
  ].join("\n");

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: t("wf_confirm_btn", locale), callback_data: "wf_confirm" },
        { text: t("wf_change_btn", locale), callback_data: "wf_change" },
      ],
    ],
  };

  await sendMessage(
    chatId,
    t("wf_summary", locale, { desc: state.pendingDescription ?? "", settings: settingsLines }),
    { parseMode: "Markdown", replyMarkup: keyboard },
  );
}

// ---------------------------------------------------------------------------
// Callback query router for workflow-related buttons
// ---------------------------------------------------------------------------

export async function handleWorkflowCallback(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  if (!chatId || !messageId) return false;

  if (data === "wf_product_ok") return handleProductConfirmOk(cq, user);
  if (data === "wf_product_other") return handleProductPickOther(cq, user);
  if (data.startsWith("wf_prodset:")) return handleProductPickSet(cq, user);
  if (data.startsWith("wf_model:")) return handleModelSelect(cq, user);
  if (data.startsWith("wf_bg:")) return handleBackgroundSelect(cq, user);
  if (data.startsWith("wf_lang:")) return handleLanguageSelect(cq, user);
  if (data === "wf_confirm") return handleSettingsConfirm(cq, user);
  if (data === "wf_change") return handleSettingsChange(cq, user);
  if (data.startsWith("wf_step_ok:")) return handleStepApprove(cq, user);
  if (data.startsWith("wf_step_replan:")) return handleStepReplan(cq, user);
  if (data === "wf_gen_all") return handleGenerateAll(cq, user);
  if (data.startsWith("wf_gen:")) return handleGenerateStep(cq, user);
  if (data.startsWith("wf_keep:")) return handleKeepResult(cq, user);
  if (data.startsWith("wf_regen:")) return handleRegenerateStep(cq, user);
  if (data.startsWith("wf_colors:")) return handleGenerateColors(cq, user);
  if (data.startsWith("wf_upscale:")) return handleUpscaleStep(cq, user);
  if (data.startsWith("wf_next:")) return handleGenerateNext(cq, user);
  if (data.startsWith("wf_gen_remaining:")) return handleGenerateRemaining(cq, user);
  if (data === "wf_overview") return handleBackToOverview(cq, user);

  return false;
}

// ---------------------------------------------------------------------------
// Settings selection handlers (sequential flow)
// ---------------------------------------------------------------------------

async function handleModelSelect(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const modelId = cq.data!.replace("wf_model:", "");
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  await setTelegramState(user.uid, {
    settingsStep: "select_background",
    pendingSettings: {
      ...state.pendingSettings,
      modelId: modelId === "none" ? undefined : modelId,
    },
  });

  await answerCallbackQuery(cq.id, t("wf_model_selected", locale));
  await editMessageReplyMarkup(chatId, messageId);
  await sendBackgroundSelection(chatId, user, locale);
  return true;
}

async function handleBackgroundSelect(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const bgId = cq.data!.replace("wf_bg:", "");
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  await setTelegramState(user.uid, {
    settingsStep: "select_language",
    pendingSettings: {
      ...state.pendingSettings,
      backgroundId: bgId === "none" ? undefined : bgId,
    },
  });

  await answerCallbackQuery(cq.id, t("wf_bg_selected", locale));
  await editMessageReplyMarkup(chatId, messageId);
  await sendLanguageSelection(chatId, locale);
  return true;
}

async function handleLanguageSelect(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const lang = cq.data!.replace("wf_lang:", "");
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  await setTelegramState(user.uid, {
    settingsStep: "confirm",
    pendingSettings: {
      ...state.pendingSettings,
      language: lang,
    },
  });

  const langLabel = lang === "de" ? "Deutsch" : "English";
  await answerCallbackQuery(cq.id, t("wf_lang_selected", locale, { lang: langLabel }));
  await editMessageReplyMarkup(chatId, messageId);
  await sendSettingsSummary(chatId, user, locale);
  return true;
}

/** User pressed "Change" on the summary — restart from model selection. */
async function handleSettingsChange(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);
  const productId = state.pendingSettings?.productId;

  await setTelegramState(user.uid, {
    settingsStep: "select_model",
    pendingSettings: productId ? { productId } : {},
  });

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await sendModelSelection(chatId, user, locale);
  return true;
}

async function advanceToModelAfterProduct(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
  productId: string,
): Promise<void> {
  await setTelegramState(user.uid, {
    settingsStep: "select_model",
    pendingSettings: { productId },
    workflowSuggestedProductId: undefined,
  });
  await sendModelSelection(chatId, user, locale);
}

async function handleProductConfirmOk(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.phase !== "awaiting_settings" || state.settingsStep !== "confirm_product") {
    return false;
  }

  const suggested = state.workflowSuggestedProductId;
  const products = await listProducts(user.workspaceId);
  if (!suggested || !products.some((p) => p.id === suggested)) {
    await answerCallbackQuery(cq.id);
    await editMessageReplyMarkup(chatId, messageId);
    await setTelegramState(user.uid, { workflowSuggestedProductId: undefined });
    await sendMessage(chatId, t("wf_product_confirm_pick", locale), {
      parseMode: "Markdown",
      replyMarkup: buildProductPickerKeyboard(products),
    });
    return true;
  }

  await answerCallbackQuery(cq.id, t("wf_product_selected", locale));
  await editMessageReplyMarkup(chatId, messageId);
  await advanceToModelAfterProduct(chatId, user, locale, suggested);
  return true;
}

async function handleProductPickOther(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.phase !== "awaiting_settings" || state.settingsStep !== "confirm_product") {
    return false;
  }

  const products = await listProducts(user.workspaceId);
  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await setTelegramState(user.uid, { workflowSuggestedProductId: undefined });
  await sendMessage(chatId, t("wf_product_confirm_pick", locale), {
    parseMode: "Markdown",
    replyMarkup: buildProductPickerKeyboard(products),
  });
  return true;
}

async function handleProductPickSet(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const productId = cq.data!.replace("wf_prodset:", "");
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.phase !== "awaiting_settings" || state.settingsStep !== "confirm_product") {
    return false;
  }

  const products = await listProducts(user.workspaceId);
  if (!products.some((p) => p.id === productId)) {
    await answerCallbackQuery(cq.id);
    return true;
  }

  await answerCallbackQuery(cq.id, t("wf_product_selected", locale));
  await editMessageReplyMarkup(chatId, messageId);
  await advanceToModelAfterProduct(chatId, user, locale, productId);
  return true;
}

// ---------------------------------------------------------------------------
// Confirm settings → create workflow → run planner
// ---------------------------------------------------------------------------

async function handleSettingsConfirm(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.pendingDescription) {
    await answerCallbackQuery(cq.id, t("wf_no_pending", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await sendMessage(chatId, t("wf_creating", locale));

  try {
    const workflowId = await createWorkflow({
      userId: user.uid,
      workspaceId: user.workspaceId,
      name: state.pendingDescription.slice(0, 100),
      description: state.pendingDescription,
      globalSettings: state.pendingSettings ?? {},
    });

    const { planWorkflow } = await import("@fashionmentum/workflow-core");
    const planned = await planWorkflow({
      description: state.pendingDescription,
      globalSettings: state.pendingSettings ?? {},
    });

    await setWorkflowSteps(
      user.workspaceId,
      workflowId,
      planned.map((s) => ({
        index: s.index,
        type: s.type,
        title: s.title,
        description: s.description,
        promptConfig: s.promptConfig,
      })),
    );

    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeWorkflowId: workflowId,
      pendingDescription: state.pendingDescription,
      pendingSettings: state.pendingSettings,
      settingsStep: undefined,
    });

    await sendPlanForReview(chatId, user, workflowId);
  } catch (err) {
    log.error("Workflow creation failed in Telegram", {
      uid: user.uid,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("wf_creation_failed", locale));
    await resetTelegramState(user.uid);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Send plan for review with per-step buttons
// ---------------------------------------------------------------------------

function buildWorkflowGenerateKeyboard(
  steps: { index: number; type: string }[],
  locale: BotLocale,
): TelegramInlineKeyboardMarkup {
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    [{ text: t("wf_gen_all_btn", locale), callback_data: "wf_gen_all" }],
  ];
  for (const s of steps) {
    if (s.type === "text") continue;
    rows.push([
      {
        text: t("wf_gen_step_btn", locale, { n: s.index + 1 }),
        callback_data: `wf_gen:${s.index}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}

/** After a failed or partial batch, show the same generate controls as on the plan summary. */
async function sendWorkflowGenerationResumePanel(
  chatId: number,
  user: UserDoc,
  workflowId: string,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const steps = await getWorkflowSteps(user.workspaceId, workflowId);
  await sendMessage(chatId, t("gen_resume_controls", locale), {
    parseMode: "Markdown",
    replyMarkup: buildWorkflowGenerateKeyboard(steps, locale),
  });
}

async function allImageStepsCompleted(
  workspaceId: string,
  workflowId: string,
): Promise<boolean> {
  const steps = await getWorkflowSteps(workspaceId, workflowId);
  const imageish = steps.filter(
    (s) => s.type === "image" || s.type === "image_with_text",
  );
  if (imageish.length === 0) return true;
  return imageish.every((s) => s.status === "completed");
}

async function sendPlanForReview(
  chatId: number,
  user: UserDoc,
  workflowId: string,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const steps = await getWorkflowSteps(user.workspaceId, workflowId);

  for (const step of steps) {
    const stepKeyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: t("wf_step_ok_btn", locale), callback_data: `wf_step_ok:${step.index}` },
          { text: t("wf_step_replan_btn", locale), callback_data: `wf_step_replan:${step.index}` },
        ],
      ],
    };

    const emoji = step.type === "image" ? "📷" : step.type === "text" ? "📝" : "📷📝";
    await sendMessage(
      chatId,
      t("wf_step_label", locale, {
        emoji,
        n: step.index + 1,
        title: escapeMarkdown(step.title),
        desc: escapeMarkdown(step.description),
      }),
      { parseMode: "Markdown", replyMarkup: stepKeyboard },
    );
  }

  await sendMessage(chatId, t("wf_plan_done", locale), {
    replyMarkup: buildWorkflowGenerateKeyboard(steps, locale),
  });
}

// ---------------------------------------------------------------------------
// Step review callbacks
// ---------------------------------------------------------------------------

async function handleStepApprove(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_step_ok:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);

  await answerCallbackQuery(cq.id, t("wf_step_confirmed", locale, { n: stepIndex + 1 }));
  await editMessageReplyMarkup(chatId, messageId);
  return true;
}

async function handleStepReplan(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_step_replan:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id, t("wf_step_replanning", locale));

  try {
    const steps = await getWorkflowSteps(user.workspaceId, state.activeWorkflowId);
    const { replanStep } = await import("@fashionmentum/workflow-core");

    const workflow = await getWorkflow(user.workspaceId, state.activeWorkflowId);
    const replanned = await replanStep({
      workflowDescription: workflow?.description ?? state.pendingDescription ?? "",
      globalSettings: workflow?.globalSettings ?? state.pendingSettings ?? {},
      existingSteps: steps.map((s) => ({
        index: s.index,
        type: s.type,
        title: s.title,
        description: s.description,
        promptConfig: s.promptConfig,
      })),
      stepIndex,
    });

    await replaceWorkflowStep(user.workspaceId, state.activeWorkflowId, stepIndex, {
      type: replanned.type,
      title: replanned.title,
      description: replanned.description,
      promptConfig: replanned.promptConfig,
    });

    const stepKeyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: t("wf_step_ok_btn", locale), callback_data: `wf_step_ok:${stepIndex}` },
          { text: t("wf_step_replan_btn", locale), callback_data: `wf_step_replan:${stepIndex}` },
        ],
      ],
    };

    const emoji = replanned.type === "image" ? "📷" : replanned.type === "text" ? "📝" : "📷📝";
    await editMessageText(
      chatId,
      messageId,
      t("wf_step_label", locale, {
        emoji,
        n: stepIndex + 1,
        title: escapeMarkdown(replanned.title),
        desc: escapeMarkdown(replanned.description),
      }),
      { parseMode: "Markdown", replyMarkup: stepKeyboard },
    );
  } catch (err) {
    log.error("Step replan failed", {
      stepIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("wf_step_replan_failed", locale, { n: stepIndex + 1 }));
  }

  return true;
}

// ---------------------------------------------------------------------------
// Generation: all steps
// ---------------------------------------------------------------------------

async function handleGenerateAll(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await setTelegramState(user.uid, { phase: "generating" });

  const workflowId = state.activeWorkflowId;
  const steps = await getWorkflowSteps(user.workspaceId, workflowId);
  const imageSteps = steps.filter((s) => s.type === "image" || s.type === "image_with_text");
  const total = imageSteps.length;

  await sendMessage(chatId, t("gen_starting", locale, { n: total }));

  let anyFailed = false;
  for (const step of imageSteps) {
    const ok = await generateSingleStep(
      chatId,
      user,
      workflowId,
      step.index,
      total,
      false,
    );
    if (!ok) anyFailed = true;
  }

  const allDone = await allImageStepsCompleted(user.workspaceId, workflowId);

  if (anyFailed || !allDone) {
    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeStepIndex: undefined,
    });
    await sendWorkflowGenerationResumePanel(chatId, user, workflowId);
    return true;
  }

  await updateWorkflow(user.workspaceId, workflowId, {
    status: "completed",
  });
  await setTelegramState(user.uid, { phase: "reviewing_results" });

  const appUrl = getTelegramAppBaseUrl();
  const detailUrl = `${appUrl}/${locale}/dashboard/workflows/${workflowId}`;
  await sendMessage(
    chatId,
    `${t("gen_all_done", locale)}\n\n🔗 ${detailUrl}`,
  );
  return true;
}

// ---------------------------------------------------------------------------
// Generation: single step (with post-generation navigation)
// ---------------------------------------------------------------------------

async function handleGenerateStep(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_gen:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await setTelegramState(user.uid, { phase: "generating", activeStepIndex: stepIndex });

  const workflowId = state.activeWorkflowId;
  const ok = await generateSingleStep(
    chatId,
    user,
    workflowId,
    stepIndex,
    undefined,
    true,
  );
  if (!ok) {
    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeStepIndex: undefined,
    });
    await sendWorkflowGenerationResumePanel(chatId, user, workflowId);
  }
  return true;
}

/** Generate next step after the current one. */
async function handleGenerateNext(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const nextIndex = parseInt(cq.data!.replace("wf_next:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await setTelegramState(user.uid, { activeStepIndex: nextIndex });

  const workflowId = state.activeWorkflowId;
  const ok = await generateSingleStep(
    chatId,
    user,
    workflowId,
    nextIndex,
    undefined,
    true,
  );
  if (!ok) {
    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeStepIndex: undefined,
    });
    await sendWorkflowGenerationResumePanel(chatId, user, workflowId);
  }
  return true;
}

/** Generate all remaining steps from a given index. */
async function handleGenerateRemaining(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const fromIndex = parseInt(cq.data!.replace("wf_gen_remaining:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);

  const steps = await getWorkflowSteps(user.workspaceId, state.activeWorkflowId);
  const remaining = steps
    .filter((s) => s.index >= fromIndex && s.type !== "text" && s.status !== "completed");
  const total = remaining.length;

  await sendMessage(chatId, t("gen_starting", locale, { n: total }));

  const workflowId = state.activeWorkflowId;
  let anyFailed = false;
  for (const step of remaining) {
    const ok = await generateSingleStep(
      chatId,
      user,
      workflowId,
      step.index,
      total,
      false,
    );
    if (!ok) anyFailed = true;
  }

  const allDone = await allImageStepsCompleted(user.workspaceId, workflowId);

  if (anyFailed || !allDone) {
    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeStepIndex: undefined,
    });
    await sendWorkflowGenerationResumePanel(chatId, user, workflowId);
    return true;
  }

  await updateWorkflow(user.workspaceId, workflowId, { status: "completed" });
  await setTelegramState(user.uid, { phase: "reviewing_results" });

  const appUrl = getTelegramAppBaseUrl();
  const detailUrl = `${appUrl}/${locale}/dashboard/workflows/${workflowId}`;
  await sendMessage(chatId, `${t("gen_all_done", locale)}\n\n🔗 ${detailUrl}`);
  return true;
}

/** Back to workflow overview — show plan again. */
async function handleBackToOverview(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id);
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);
  await setTelegramState(user.uid, { phase: "reviewing_plan" });
  await sendPlanForReview(chatId, user, state.activeWorkflowId);
  return true;
}

// ---------------------------------------------------------------------------
// Core single-step generation logic
// ---------------------------------------------------------------------------

async function generateSingleStep(
  chatId: number,
  user: UserDoc,
  workflowId: string,
  stepIndex: number,
  totalSteps?: number,
  showNavigation?: boolean,
): Promise<boolean> {
  const locale = resolveLocale(user.preferredLocale);
  const steps = await getWorkflowSteps(user.workspaceId, workflowId);
  const step = steps.find((s) => s.index === stepIndex);
  if (!step) return false;

  const progressMsg = totalSteps
    ? t("gen_progress", locale, { current: stepIndex + 1, total: totalSteps })
    : t("gen_single", locale, { n: stepIndex + 1 });
  await sendMessage(chatId, progressMsg);

  const quota = await checkQuota(user.workspaceId);
  if (!quota.allowed) {
    await sendMessage(chatId, t("gen_quota_exceeded", locale, { used: quota.used, limit: quota.limit }));
    await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, { status: "failed" });
    return false;
  }

  await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, { status: "generating" });

  const workflow = await getWorkflow(user.workspaceId, workflowId);
  if (!workflow) {
    await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, { status: "failed" });
    return false;
  }

  if (workflow.status !== "in_progress") {
    await updateWorkflow(user.workspaceId, workflowId, { status: "in_progress" });
  }

  try {
    if (step.type === "text") {
      const { generateText } = await import("@/lib/generation/gemini-text");
      const text = step.promptConfig.textPrompt
        ? await generateText(step.promptConfig.textPrompt as string)
        : "[No text prompt configured]";
      await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, {
        status: "completed",
        resultText: text,
      });
      await sendMessage(chatId, `📝 *${locale === "de" ? "Schritt" : "Step"} ${stepIndex + 1}:*\n\n${text.slice(0, 3000)}`, {
        parseMode: "Markdown",
      });
      return true;
    }

    const products = await listProducts(user.workspaceId);
    const pc = step.promptConfig;
    const gs = workflow.globalSettings ?? {};
    let productId =
      typeof gs?.productId === "string" && gs.productId.trim()
        ? gs.productId.trim()
        : "";
    if (productId) {
      const exists = await getProduct(user.workspaceId, productId).catch(() => null);
      if (!exists) productId = "";
    }
    if (!productId) productId = products[0]?.id ?? "";
    if (!productId) {
      await sendMessage(chatId, t("gen_no_product", locale));
      await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, { status: "failed" });
      return false;
    }

    const { startImageJob, getJob } = await import("@fashionmentum/workflow-core");
    const { listHumanModelIds } = await import("@/lib/db/human-models");

    const allowedModelIds = await listHumanModelIds(user.workspaceId);
    const productDoc = await getProduct(user.workspaceId, productId).catch(() => null);

    type WfType = import("@fashionmentum/workflow-core").StartImageJobInput["workflowType"];

    const cfg = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;

    const mergedAspect = cfg(pc.aspectRatio) ?? cfg(gs.aspectRatio) ?? undefined;
    const mergedResolution = cfg(pc.resolution) ?? cfg(gs.resolution) ?? undefined;
    const rawIm = cfg(pc.imageModel) ?? cfg(gs.imageModel) ?? undefined;
    const mergedImageModel = rawIm && isAllowedGeminiImageModel(rawIm) ? rawIm : undefined;

    const result = await startImageJob({
      productId,
      workflowType: (pc.workflowType as WfType) ?? "NEUTRAL_PRODUCT_SHOT",
      productCategory: (pc.productCategory as string) || productDoc?.category || undefined,
      aspectRatio: mergedAspect,
      resolution: mergedResolution,
      poseDescription: cfg(pc.poseDescription),
      modelId: cfg(gs.modelId),
      backgroundId: cfg(gs.backgroundId),
      allowedModelIds,
      scoreQuality: true,
      userPromptBlock: productDoc?.userPromptBlockCompiled || undefined,
      ...(mergedImageModel ? { imageModel: mergedImageModel } : {}),
    });

    const job = await getJob(result.jobId);
    const imagePath = job.images?.[0]?.filePath;

    await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, {
      status: "completed",
      resultImagePath: imagePath,
    });

    await consumeCredit(user.workspaceId);

    if (imagePath) {
      const imageSteps = steps.filter((s) => s.type === "image" || s.type === "image_with_text");
      const currentPos = imageSteps.findIndex((s) => s.index === stepIndex);
      const nextImageStep = imageSteps[currentPos + 1];

      const hasColors = (productDoc?.colors?.length ?? 0) > 0;

      await sendGeneratedImage(
        chatId,
        imagePath,
        stepIndex,
        step.title,
        locale,
        showNavigation ? nextImageStep?.index : undefined,
        totalSteps
          ? { current: currentPos + 1, total: totalSteps }
          : undefined,
        { productHasColors: hasColors },
      );
    } else {
      await sendMessage(chatId, t("gen_step_done", locale, { n: stepIndex + 1 }));
    }
    return true;
  } catch (err) {
    log.error("Step generation failed", {
      stepIndex,
      workflowId,
      error: err instanceof Error ? err.message : String(err),
    });
    await updateWorkflowStep(user.workspaceId, workflowId, stepIndex, { status: "failed" });
    await sendMessage(chatId, t("gen_step_failed", locale, { n: stepIndex + 1 }));
    return false;
  }
}

async function sendGeneratedImage(
  chatId: number,
  imagePath: string,
  stepIndex: number,
  title: string,
  locale: BotLocale,
  nextStepIndex?: number,
  progress?: { current: number; total: number },
  opts?: { productHasColors?: boolean },
): Promise<void> {
  try {
    const { readWorkflowDataFile } = await import("@fashionmentum/workflow-core");
    const buffer = await readWorkflowDataFile(imagePath);

    const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
      [
        { text: t("gen_keep_btn", locale), callback_data: `wf_keep:${stepIndex}` },
        { text: t("gen_regen_btn", locale), callback_data: `wf_regen:${stepIndex}` },
      ],
    ];

    if (opts?.productHasColors) {
      buttons.push([
        { text: t("gen_colors_btn", locale), callback_data: `wf_colors:${stepIndex}` },
      ]);
    }

    buttons.push([
      { text: t("gen_upscale_btn", locale), callback_data: `wf_upscale:${stepIndex}` },
    ]);

    if (nextStepIndex !== undefined) {
      buttons.push([
        { text: t("gen_next_btn", locale), callback_data: `wf_next:${nextStepIndex}` },
        { text: t("gen_remaining_btn", locale), callback_data: `wf_gen_remaining:${nextStepIndex}` },
      ]);
    }

    buttons.push([
      { text: t("gen_overview_btn", locale), callback_data: "wf_overview" },
    ]);

    const caption = progress
      ? t("gen_image_caption", locale, {
          current: progress.current,
          total: progress.total,
          n: stepIndex + 1,
          title,
        })
      : t("gen_image_caption_single", locale, { n: stepIndex + 1, title });

    await sendPhoto(chatId, buffer, {
      caption,
      replyMarkup: { inline_keyboard: buttons },
    });
  } catch (err) {
    log.error("Failed to send image", {
      imagePath,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(
      chatId,
      t("gen_image_send_failed", locale, { n: stepIndex + 1 }),
    );
  }
}

// ---------------------------------------------------------------------------
// Color generation via Hero Lock
// ---------------------------------------------------------------------------

async function handleGenerateColors(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_colors:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);

  const steps = await getWorkflowSteps(user.workspaceId, state.activeWorkflowId);
  const step = steps.find((s) => s.index === stepIndex);
  if (!step || step.status !== "completed" || !step.resultImagePath) {
    return true;
  }

  const workflow = await getWorkflow(user.workspaceId, state.activeWorkflowId);
  if (!workflow) return true;

  const products = await listProducts(user.workspaceId);
  const gs = workflow.globalSettings ?? {};
  let productId =
    typeof gs.productId === "string" && gs.productId.trim()
      ? gs.productId.trim()
      : "";
  if (productId) {
    const exists = await getProduct(user.workspaceId, productId).catch(() => null);
    if (!exists) productId = "";
  }
  if (!productId) productId = products[0]?.id ?? "";

  const fullProduct = productId
    ? await getProduct(user.workspaceId, productId).catch(() => null)
    : null;
  const colors = fullProduct?.colors ?? [];

  if (colors.length === 0) {
    await sendMessage(chatId, t("gen_colors_no_colors", locale));
    return true;
  }

  const quota = await checkQuota(user.workspaceId);
  if (quota.remaining < colors.length) {
    await sendMessage(chatId, t("gen_colors_quota", locale, {
      needed: colors.length,
      remaining: quota.remaining,
    }));
    return true;
  }

  await sendMessage(chatId, t("gen_colors_generating", locale, { n: stepIndex + 1 }));

  try {
    const { executeHeroLock } = await import("@fashionmentum/workflow-core");
    const { randomUUID } = await import("node:crypto");

    const syntheticVariant = {
      id: randomUUID(),
      jobId: `workflow-${state.activeWorkflowId}-step-${stepIndex}`,
      productId,
      status: "hero_lock" as const,
      filePath: step.resultImagePath,
      createdAt: new Date().toISOString(),
    };

    const targetColors = colors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
    }));

    const result = await executeHeroLock(syntheticVariant, targetColors);

    const colorVariants = result.generatedVariants.map((v) => ({
      colorId: targetColors.find((c) => c.name === v.colorName)?.id ?? v.variantId,
      colorName: v.colorName,
      colorHex: v.colorHex,
      imagePath: v.filePath ?? "",
      status: v.status === "completed" ? ("completed" as const) : ("failed" as const),
    }));

    await updateWorkflowStep(user.workspaceId, state.activeWorkflowId, stepIndex, {
      colorVariants,
    });

    const successCount = colorVariants.filter((v) => v.status === "completed").length;
    if (successCount > 0) {
      await consumeCredit(user.workspaceId, successCount);
    }

    const appUrl = getTelegramAppBaseUrl();
    const wfUrl = `${appUrl}/${locale}/dashboard/workflows/${state.activeWorkflowId}`;

    await sendMessage(chatId, t("gen_colors_done", locale, {
      count: successCount,
      n: stepIndex + 1,
      url: wfUrl,
    }));
  } catch (err) {
    log.error("Color generation failed", {
      stepIndex,
      workflowId: state.activeWorkflowId,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("gen_colors_failed", locale));
  }

  return true;
}

// ---------------------------------------------------------------------------
// Feedback: keep or regenerate
// ---------------------------------------------------------------------------

async function handleKeepResult(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_keep:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);

  await answerCallbackQuery(cq.id, t("gen_kept", locale, { n: stepIndex + 1 }));
  await editMessageReplyMarkup(chatId, messageId);
  return true;
}

async function handleUpscaleStep(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_upscale:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id, t("gen_upscaling", locale));
  await editMessageReplyMarkup(chatId, messageId);

  try {
    const {
      isUpscalerAvailable,
      upscaleImage,
      upscaledPath,
      readWorkflowDataFile,
      getWorkflowDataRoot,
      usesGcsBlobStorage,
      putDataObject,
    } = await import("@fashionmentum/workflow-core");

    if (!isUpscalerAvailable()) {
      await sendMessage(chatId, t("gen_upscale_unavailable", locale));
      return true;
    }

    const steps = await getWorkflowSteps(user.workspaceId, state.activeWorkflowId);
    const step = steps.find((s) => s.index === stepIndex);
    if (!step || step.status !== "completed" || !step.resultImagePath) {
      return true;
    }

    const imagePath = step.resultImagePath;
    const outputKey = upscaledPath(imagePath);
    const dataRoot = getWorkflowDataRoot();
    const { resolve, isAbsolute } = await import("node:path");

    if (usesGcsBlobStorage() && !isAbsolute(imagePath)) {
      const buffer = await readWorkflowDataFile(imagePath);
      const fs = await import("fs/promises");
      const tmpIn = resolve(dataRoot, `__tg_upscale_in_${stepIndex}.png`);
      const tmpOut = resolve(dataRoot, `__tg_upscale_out_${stepIndex}.png`);
      await fs.mkdir(dataRoot, { recursive: true });
      await fs.writeFile(tmpIn, buffer);
      try {
        await upscaleImage(tmpIn, tmpOut);
        const outBuffer = await fs.readFile(tmpOut);
        await putDataObject(outputKey, outBuffer, "image/png");
      } finally {
        await fs.unlink(tmpIn).catch(() => {});
        await fs.unlink(tmpOut).catch(() => {});
      }
    } else {
      const absIn = isAbsolute(imagePath) ? imagePath : resolve(dataRoot, imagePath);
      const absOut = isAbsolute(outputKey) ? outputKey : resolve(dataRoot, outputKey);
      await upscaleImage(absIn, absOut);
    }

    await updateWorkflowStep(user.workspaceId, state.activeWorkflowId, stepIndex, {
      upscaledImagePath: outputKey,
    });

    const upscaledBuffer = await readWorkflowDataFile(outputKey);
    await sendPhoto(chatId, upscaledBuffer, {
      caption: t("gen_upscale_done", locale, { n: stepIndex + 1 }),
    });
  } catch (err) {
    log.error("Telegram upscale failed", {
      stepIndex,
      workflowId: state.activeWorkflowId,
      error: err instanceof Error ? err.message : String(err),
    });
    await sendMessage(chatId, t("gen_upscale_failed", locale));
  }

  return true;
}

async function handleRegenerateStep(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const stepIndex = parseInt(cq.data!.replace("wf_regen:", ""), 10);
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (!state.activeWorkflowId) {
    await answerCallbackQuery(cq.id, t("wf_no_active", locale));
    return true;
  }

  await answerCallbackQuery(cq.id, t("gen_regenerating", locale));
  await editMessageReplyMarkup(chatId, messageId);

  const oldStep = (await getWorkflowSteps(user.workspaceId, state.activeWorkflowId)).find(
    (s) => s.index === stepIndex,
  );

  if (oldStep?.resultImagePath) {
    log.info("Marking old result as rejected", {
      workflowId: state.activeWorkflowId,
      stepIndex,
      oldPath: oldStep.resultImagePath,
    });
  }

  const workflowId = state.activeWorkflowId;
  const ok = await generateSingleStep(
    chatId,
    user,
    workflowId,
    stepIndex,
    undefined,
    true,
  );
  if (!ok) {
    await setTelegramState(user.uid, {
      phase: "reviewing_plan",
      activeStepIndex: undefined,
    });
    await sendWorkflowGenerationResumePanel(chatId, user, workflowId);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Workflow list (for /workflows command)
// ---------------------------------------------------------------------------

export async function sendWorkflowList(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const workflows = await listWorkflows(user.workspaceId);

  if (workflows.length === 0) {
    await sendMessage(chatId, t("wf_list_empty", locale));
    return;
  }

  const statusLabels: Record<string, string> = locale === "de"
    ? { draft: "Entwurf", planned: "Geplant", in_progress: "In Arbeit", completed: "Fertig" }
    : { draft: "Draft", planned: "Planned", in_progress: "In Progress", completed: "Completed" };

  let text = `${t("wf_list_title", locale)}\n\n`;
  const appUrl = getTelegramAppBaseUrl();
  const allowInline = isTelegramInlineButtonUrlAllowed(`${appUrl}/`);
  const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const plainUrls: string[] = [];

  for (const wf of workflows.slice(0, 10)) {
    let done = 0;
    let total = 0;
    try {
      const steps = await getWorkflowSteps(user.workspaceId, wf.id);
      total = steps.length;
      done = steps.filter((s) => s.status === "completed").length;
    } catch {
      // steps may not exist yet for drafts
    }

    text += t("wf_list_item", locale, {
      name: escapeMarkdown(wf.name),
      status: statusLabels[wf.status] ?? wf.status,
      done,
      total,
    }) + "\n\n";

    const u = `${appUrl}/${locale}/dashboard/workflows/${wf.id}`;
    if (allowInline) {
      buttons.push([{ text: `📂 ${wf.name.slice(0, 30)}`, url: u }]);
    } else {
      plainUrls.push(u);
    }
  }

  if (!allowInline && plainUrls.length > 0) {
    text += t("resource_list_localhost_urls_footer", locale) + plainUrls.join("\n");
  }

  await sendMessage(chatId, text, {
    parseMode: "Markdown",
    replyMarkup: allowInline && buttons.length > 0
      ? { inline_keyboard: buttons }
      : undefined,
  });
}

/** /newworkflow — prompt user for a description, then start the creation flow. */
export async function promptNewWorkflow(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);

  await setTelegramState(user.uid, {
    phase: "awaiting_settings",
    settingsStep: "awaiting_description",
    pendingDescription: undefined,
    pendingSettings: {},
    activeWorkflowId: undefined,
    activeStepIndex: undefined,
  });

  await sendMessage(chatId, t("newworkflow_prompt", locale));
}

/** Handle freetext when we're awaiting a workflow description. Returns true if consumed. */
export async function handleWorkflowDescriptionFreetext(
  chatId: number,
  user: UserDoc,
  text: string,
): Promise<boolean> {
  const state = await getTelegramState(user.uid);
  if (state.phase !== "awaiting_settings" || state.settingsStep !== "awaiting_description") {
    return false;
  }

  await startWorkflowCreation(chatId, user, text);
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
