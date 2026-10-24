import { createLogger } from "@/lib/logger";
import {
  sendMessage,
  answerCallbackQuery,
  editMessageReplyMarkup,
} from "./client";
import { t, resolveLocale } from "./bot-messages";
import {
  getTelegramState,
  setTelegramState,
  resetTelegramState,
} from "@/lib/db/telegram-state";
import { createHumanModel, listHumanModels } from "@/lib/db/human-models";
import { createBackground, listBackgrounds } from "@/lib/db/backgrounds";
import { createProduct, listProducts } from "@/lib/db/products";
import { createBrand, listBrands } from "@/lib/db/brands";
import type { UserDoc } from "@/lib/db/types";
import type {
  TelegramCallbackQuery,
  TelegramInlineKeyboardMarkup,
  BotLocale,
} from "./types";
import {
  getTelegramAppBaseUrl,
  isTelegramInlineButtonUrlAllowed,
} from "./app-url";

const log = createLogger("telegram:resource");

// ---------------------------------------------------------------------------
// Callback router for resource creation flows
// ---------------------------------------------------------------------------

export async function handleResourceCallback(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const data = cq.data ?? "";

  if (data.startsWith("res_model_")) return handleModelCallback(cq, user);
  if (data.startsWith("res_bg_")) return handleBackgroundCallback(cq, user);
  if (data.startsWith("res_prod_")) return handleProductCallback(cq, user);

  return false;
}

/**
 * Handle freetext input during a multi-step resource creation flow.
 * Returns true if the message was consumed by an active resource flow.
 */
export async function handleResourceFreetext(
  chatId: number,
  user: UserDoc,
  text: string,
): Promise<boolean> {
  const state = await getTelegramState(user.uid);

  switch (state.phase) {
    case "creating_model":
      return handleModelFreetext(chatId, user, text);
    case "creating_background":
      return handleBackgroundFreetext(chatId, user, text);
    case "creating_product":
      return handleProductFreetext(chatId, user, text);
    default:
      return false;
  }
}

// ============================================================================
// MODEL CREATION
// Flow: type → name → (AI: freetext → gender → age → build → hair) / (Human: notes) → done
// ============================================================================

export async function startModelCreation(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);

  await setTelegramState(user.uid, {
    phase: "creating_model",
    resourceStep: "type",
    pendingResource: {},
    activeWorkflowId: undefined,
    activeStepIndex: undefined,
  });

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: t("model_human_btn", locale), callback_data: "res_model_type:human" },
        { text: t("model_ai_btn", locale), callback_data: "res_model_type:ai" },
      ],
    ],
  };

  await sendMessage(chatId, t("model_start", locale), {
    parseMode: "Markdown",
    replyMarkup: keyboard,
  });
}

async function handleModelCallback(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const data = cq.data ?? "";
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);

  if (data.startsWith("res_model_type:")) {
    const modelType = data.replace("res_model_type:", "");
    await setTelegramState(user.uid, {
      resourceStep: "name",
      pendingResource: { source: modelType },
    });
    await sendMessage(chatId, t("model_name_prompt", locale));
    return true;
  }

  if (data.startsWith("res_model_gender:")) {
    const val = data.replace("res_model_gender:", "");
    const state = await getTelegramState(user.uid);
    await setTelegramState(user.uid, {
      resourceStep: "age",
      pendingResource: { ...state.pendingResource, gender: val === "any" ? "" : val },
    });
    await sendAgeSelection(chatId, locale);
    return true;
  }

  if (data.startsWith("res_model_age:")) {
    const val = data.replace("res_model_age:", "");
    const state = await getTelegramState(user.uid);
    await setTelegramState(user.uid, {
      resourceStep: "build",
      pendingResource: { ...state.pendingResource, ageRange: val === "any" ? "" : val },
    });
    await sendBuildSelection(chatId, locale);
    return true;
  }

  if (data.startsWith("res_model_build:")) {
    const val = data.replace("res_model_build:", "");
    const state = await getTelegramState(user.uid);
    await setTelegramState(user.uid, {
      resourceStep: "hair",
      pendingResource: { ...state.pendingResource, bodyBuild: val === "any" ? "" : val },
    });
    await sendHairSelection(chatId, locale);
    return true;
  }

  if (data.startsWith("res_model_hair:")) {
    const val = data.replace("res_model_hair:", "");
    const state = await getTelegramState(user.uid);
    const res = { ...state.pendingResource, hairLength: val === "any" ? "" : val };
    await finalizeModelCreation(chatId, user, locale, res);
    return true;
  }

  return false;
}

async function handleModelFreetext(
  chatId: number,
  user: UserDoc,
  text: string,
): Promise<boolean> {
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.resourceStep === "name") {
    const source = state.pendingResource?.source ?? "human";
    if (source === "ai") {
      await setTelegramState(user.uid, {
        resourceStep: "freetext",
        pendingResource: { ...state.pendingResource, displayName: text.slice(0, 120) },
      });
      await sendMessage(chatId, t("model_freetext_prompt", locale));
    } else {
      await setTelegramState(user.uid, {
        resourceStep: "notes",
        pendingResource: { ...state.pendingResource, displayName: text.slice(0, 120) },
      });
      await sendMessage(chatId, t("model_notes_prompt", locale));
    }
    return true;
  }

  if (state.resourceStep === "freetext") {
    await setTelegramState(user.uid, {
      resourceStep: "gender",
      pendingResource: { ...state.pendingResource, aiPrompt: text.slice(0, 2000) },
    });
    await sendGenderSelection(chatId, locale);
    return true;
  }

  if (state.resourceStep === "notes") {
    const notes = text.toLowerCase() === "skip" ? "" : text.slice(0, 500);
    const res = { ...state.pendingResource, notes };
    await finalizeModelCreation(chatId, user, locale, res);
    return true;
  }

  return false;
}

async function sendGenderSelection(chatId: number, locale: BotLocale): Promise<void> {
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: t("model_gender_female", locale), callback_data: "res_model_gender:female" },
        { text: t("model_gender_male", locale), callback_data: "res_model_gender:male" },
      ],
      [
        { text: t("model_gender_nb", locale), callback_data: "res_model_gender:non-binary" },
        { text: t("model_gender_any", locale), callback_data: "res_model_gender:any" },
      ],
    ],
  };
  await sendMessage(chatId, t("model_gender_prompt", locale), { replyMarkup: keyboard });
}

async function sendAgeSelection(chatId: number, locale: BotLocale): Promise<void> {
  const ages = ["18-25", "25-35", "35-45", "45-55", "55+"];
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    ages.slice(0, 3).map((a) => ({ text: a, callback_data: `res_model_age:${a}` })),
    [
      ...ages.slice(3).map((a) => ({ text: a, callback_data: `res_model_age:${a}` })),
      { text: t("model_age_any", locale), callback_data: "res_model_age:any" },
    ],
  ];
  await sendMessage(chatId, t("model_age_prompt", locale), { replyMarkup: { inline_keyboard: rows } });
}

async function sendBuildSelection(chatId: number, locale: BotLocale): Promise<void> {
  const builds: [string, string][] = [
    ["slim", t("model_build_slim", locale)],
    ["athletic", t("model_build_athletic", locale)],
    ["average", t("model_build_average", locale)],
    ["curvy", t("model_build_curvy", locale)],
    ["plus-size", t("model_build_plussize", locale)],
    ["muscular", t("model_build_muscular", locale)],
  ];
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    builds.slice(0, 3).map(([v, label]) => ({ text: label, callback_data: `res_model_build:${v}` })),
    builds.slice(3).map(([v, label]) => ({ text: label, callback_data: `res_model_build:${v}` })),
    [{ text: t("model_build_any", locale), callback_data: "res_model_build:any" }],
  ];
  await sendMessage(chatId, t("model_build_prompt", locale), { replyMarkup: { inline_keyboard: rows } });
}

async function sendHairSelection(chatId: number, locale: BotLocale): Promise<void> {
  const hairs: [string, string][] = [
    ["short", t("model_hair_short", locale)],
    ["medium", t("model_hair_medium", locale)],
    ["long", t("model_hair_long", locale)],
    ["very long", t("model_hair_verylong", locale)],
    ["shaved", t("model_hair_shaved", locale)],
  ];
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    hairs.slice(0, 3).map(([v, label]) => ({ text: label, callback_data: `res_model_hair:${v}` })),
    [
      ...hairs.slice(3).map(([v, label]) => ({ text: label, callback_data: `res_model_hair:${v}` })),
      { text: t("model_hair_any", locale), callback_data: "res_model_hair:any" },
    ],
  ];
  await sendMessage(chatId, t("model_hair_prompt", locale), { replyMarkup: { inline_keyboard: rows } });
}

async function finalizeModelCreation(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
  res: Record<string, string | undefined>,
): Promise<void> {
  try {
    const modelId = await createHumanModel({
      workspaceId: user.workspaceId,
      displayName: res.displayName ?? "Unnamed",
      notes: res.notes ?? "",
      source: (res.source as "human" | "ai") ?? "human",
      aiPrompt: res.aiPrompt,
      gender: res.gender || undefined,
      ageRange: res.ageRange || undefined,
      bodyBuild: res.bodyBuild || undefined,
      hairLength: res.hairLength || undefined,
    });

    await resetTelegramState(user.uid);
    await sendMessage(
      chatId,
      t("model_created", locale, { name: res.displayName ?? "Unnamed" }),
      { parseMode: "Markdown" },
    );

    const appUrl = getTelegramAppBaseUrl();
    const detailUrl = `${appUrl}/${locale}/dashboard/human-models/${modelId}`;
    await sendMessage(chatId, t("model_upload_hint", locale, { url: detailUrl }));
  } catch (err) {
    log.error("Model creation failed", { error: err instanceof Error ? err.message : String(err) });
    await sendMessage(chatId, t("model_creation_failed", locale));
    await resetTelegramState(user.uid);
  }
}

// ============================================================================
// BACKGROUND CREATION
// Flow: type (canvas/freestyle/upload) → name → description → done
// ============================================================================

export async function startBackgroundCreation(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);

  await setTelegramState(user.uid, {
    phase: "creating_background",
    resourceStep: "type",
    pendingResource: {},
    activeWorkflowId: undefined,
    activeStepIndex: undefined,
  });

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: t("bg_canvas_btn", locale), callback_data: "res_bg_type:canvas" },
        { text: t("bg_freestyle_btn", locale), callback_data: "res_bg_type:freestyle" },
        { text: t("bg_upload_btn", locale), callback_data: "res_bg_type:upload" },
      ],
    ],
  };

  await sendMessage(chatId, t("bg_start", locale), {
    parseMode: "Markdown",
    replyMarkup: keyboard,
  });
}

async function handleBackgroundCallback(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const data = cq.data ?? "";
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);

  if (data.startsWith("res_bg_type:")) {
    const bgType = data.replace("res_bg_type:", "");
    await setTelegramState(user.uid, {
      resourceStep: "name",
      pendingResource: { type: bgType },
    });
    await sendMessage(chatId, t("bg_name_prompt", locale));
    return true;
  }

  return false;
}

async function handleBackgroundFreetext(
  chatId: number,
  user: UserDoc,
  text: string,
): Promise<boolean> {
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.resourceStep === "name") {
    const bgType = state.pendingResource?.type ?? "freestyle";
    await setTelegramState(user.uid, {
      resourceStep: bgType === "upload" ? "upload" : "description",
      pendingResource: { ...state.pendingResource, name: text.slice(0, 120) },
    });

    if (bgType === "upload") {
      await sendMessage(chatId, t("bg_upload_prompt", locale));
    } else {
      await sendMessage(chatId, t("bg_desc_prompt", locale));
    }
    return true;
  }

  if (state.resourceStep === "description") {
    const res = state.pendingResource ?? {};
    await finalizeBackgroundCreation(chatId, user, locale, {
      ...res,
      description: text.slice(0, 2000),
    });
    return true;
  }

  if (state.resourceStep === "upload") {
    const appUrl = getTelegramAppBaseUrl();
    const url = `${appUrl}/${locale}/dashboard/backgrounds`;
    await sendMessage(chatId, t("bg_upload_hint", locale, { url }));
    await resetTelegramState(user.uid);
    return true;
  }

  return false;
}

async function finalizeBackgroundCreation(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
  res: Record<string, string | undefined>,
): Promise<void> {
  try {
    await createBackground({
      workspaceId: user.workspaceId,
      name: res.name ?? "Unnamed",
      type: (res.type as "canvas" | "freestyle" | "upload") ?? "freestyle",
      description: res.description ?? "",
    });

    await resetTelegramState(user.uid);
    await sendMessage(
      chatId,
      t("bg_created", locale, { name: res.name ?? "Unnamed" }),
      { parseMode: "Markdown" },
    );
  } catch (err) {
    log.error("Background creation failed", { error: err instanceof Error ? err.message : String(err) });
    await sendMessage(chatId, t("bg_creation_failed", locale));
    await resetTelegramState(user.uid);
  }
}

// ============================================================================
// PRODUCT CREATION
// Flow: name → brand (select or new) → category → description → done
// ============================================================================

export async function startProductCreation(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);

  await setTelegramState(user.uid, {
    phase: "creating_product",
    resourceStep: "name",
    pendingResource: {},
    activeWorkflowId: undefined,
    activeStepIndex: undefined,
  });

  await sendMessage(chatId, t("prod_start", locale), { parseMode: "Markdown" });
  await sendMessage(chatId, t("prod_name_prompt", locale));
}

async function handleProductCallback(
  cq: TelegramCallbackQuery,
  user: UserDoc,
): Promise<boolean> {
  const data = cq.data ?? "";
  const chatId = cq.message!.chat.id;
  const messageId = cq.message!.message_id;
  const locale = resolveLocale(user.preferredLocale);

  await answerCallbackQuery(cq.id);
  await editMessageReplyMarkup(chatId, messageId);

  if (data.startsWith("res_prod_brand:")) {
    const brandId = data.replace("res_prod_brand:", "");
    const state = await getTelegramState(user.uid);

    if (brandId === "new") {
      await setTelegramState(user.uid, { resourceStep: "brand_name" });
      await sendMessage(chatId, t("prod_brand_name_prompt", locale));
    } else {
      await setTelegramState(user.uid, {
        resourceStep: "category",
        pendingResource: { ...state.pendingResource, brandId },
      });
      await sendCategorySelection(chatId, locale);
    }
    return true;
  }

  if (data.startsWith("res_prod_cat:")) {
    const cat = data.replace("res_prod_cat:", "");
    const state = await getTelegramState(user.uid);
    await setTelegramState(user.uid, {
      resourceStep: "description",
      pendingResource: { ...state.pendingResource, category: cat },
    });
    await sendMessage(chatId, t("prod_desc_prompt", locale));
    return true;
  }

  if (data === "res_prod_create_brand_yes") {
    await setTelegramState(user.uid, { resourceStep: "brand_name" });
    await sendMessage(chatId, t("prod_brand_name_prompt", locale));
    return true;
  }

  return false;
}

async function handleProductFreetext(
  chatId: number,
  user: UserDoc,
  text: string,
): Promise<boolean> {
  const locale = resolveLocale(user.preferredLocale);
  const state = await getTelegramState(user.uid);

  if (state.resourceStep === "name") {
    await setTelegramState(user.uid, {
      resourceStep: "brand",
      pendingResource: { ...state.pendingResource, name: text.slice(0, 200) },
    });
    await sendBrandSelection(chatId, user, locale);
    return true;
  }

  if (state.resourceStep === "brand_name") {
    try {
      const brandId = await createBrand({
        workspaceId: user.workspaceId,
        name: text.slice(0, 100),
        isPrivateLabel: true,
        dna: "",
        targetAudience: "",
        productCategory: "",
        tone: "",
      });
      await setTelegramState(user.uid, {
        resourceStep: "category",
        pendingResource: { ...state.pendingResource, brandId },
      });
      await sendCategorySelection(chatId, locale);
    } catch (err) {
      log.error("Brand creation failed", { error: err instanceof Error ? err.message : String(err) });
      await sendMessage(chatId, t("prod_creation_failed", locale));
      await resetTelegramState(user.uid);
    }
    return true;
  }

  if (state.resourceStep === "description") {
    const desc = text.toLowerCase() === "skip" ? "" : text.slice(0, 2000);
    const res = { ...state.pendingResource, description: desc };
    await finalizeProductCreation(chatId, user, locale, res);
    return true;
  }

  return false;
}

async function sendBrandSelection(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
): Promise<void> {
  const brands = await listBrands(user.workspaceId);

  if (brands.length === 0) {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: t("prod_no_brands_yes", locale), callback_data: "res_prod_create_brand_yes" }],
      ],
    };
    await sendMessage(chatId, t("prod_no_brands", locale), { replyMarkup: keyboard });
    return;
  }

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const batch: { text: string; callback_data: string }[] = [];
  for (const b of brands.slice(0, 8)) {
    batch.push({ text: b.name, callback_data: `res_prod_brand:${b.id}` });
    if (batch.length === 2) {
      rows.push([...batch]);
      batch.length = 0;
    }
  }
  if (batch.length > 0) rows.push([...batch]);
  rows.push([{ text: t("prod_brand_new", locale), callback_data: "res_prod_brand:new" }]);

  await sendMessage(chatId, t("prod_brand_prompt", locale), {
    replyMarkup: { inline_keyboard: rows },
  });
}

async function sendCategorySelection(chatId: number, locale: BotLocale): Promise<void> {
  const cats: [string, string][] = [
    ["handheld", t("prod_cat_handheld", locale)],
    ["wearable", t("prod_cat_wearable", locale)],
    ["furniture", t("prod_cat_furniture", locale)],
    ["outdoor", t("prod_cat_outdoor", locale)],
    ["kitchen", t("prod_cat_kitchen", locale)],
    ["beauty", t("prod_cat_beauty", locale)],
    ["decor", t("prod_cat_decor", locale)],
    ["fitness", t("prod_cat_fitness", locale)],
    ["generic", t("prod_cat_generic", locale)],
  ];

  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [
    cats.slice(0, 3).map(([v, label]) => ({ text: label, callback_data: `res_prod_cat:${v}` })),
    cats.slice(3, 6).map(([v, label]) => ({ text: label, callback_data: `res_prod_cat:${v}` })),
    cats.slice(6).map(([v, label]) => ({ text: label, callback_data: `res_prod_cat:${v}` })),
  ];

  await sendMessage(chatId, t("prod_category_prompt", locale), {
    replyMarkup: { inline_keyboard: rows },
  });
}

async function finalizeProductCreation(
  chatId: number,
  user: UserDoc,
  locale: BotLocale,
  res: Record<string, string | undefined>,
): Promise<void> {
  try {
    const productId = await createProduct({
      workspaceId: user.workspaceId,
      brandId: res.brandId ?? "",
      name: res.name ?? "Unnamed",
      category: res.category ?? "generic",
      description: res.description ?? "",
    });

    await resetTelegramState(user.uid);
    await sendMessage(
      chatId,
      t("prod_created", locale, { name: res.name ?? "Unnamed" }),
      { parseMode: "Markdown" },
    );

    const appUrl = getTelegramAppBaseUrl();
    const detailUrl = `${appUrl}/${locale}/dashboard/products/${productId}`;
    await sendMessage(chatId, t("prod_detail_link", locale, { url: detailUrl }));
  } catch (err) {
    log.error("Product creation failed", { error: err instanceof Error ? err.message : String(err) });
    await sendMessage(chatId, t("prod_creation_failed", locale));
    await resetTelegramState(user.uid);
  }
}

// ============================================================================
// RESOURCE LIST COMMANDS
// ============================================================================

export async function sendProductList(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const products = await listProducts(user.workspaceId);

  if (products.length === 0) {
    await sendMessage(chatId, t("prod_list_empty", locale));
    return;
  }

  const appUrl = getTelegramAppBaseUrl();
  const allowInline = isTelegramInlineButtonUrlAllowed(`${appUrl}/`);
  let text = `${t("prod_list_title", locale)}\n\n`;
  const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const plainUrls: string[] = [];

  for (const p of products.slice(0, 10)) {
    text += t("prod_list_item", locale, {
      name: escapeMarkdown(p.name),
      category: p.category ?? "–",
      status: p.status ?? "active",
    }) + "\n\n";

    const u = `${appUrl}/${locale}/dashboard/products/${p.id}`;
    if (allowInline) {
      buttons.push([{ text: `📦 ${p.name.slice(0, 30)}`, url: u }]);
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

export async function sendModelList(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const models = await listHumanModels(user.workspaceId);

  if (models.length === 0) {
    await sendMessage(chatId, t("model_list_empty", locale));
    return;
  }

  const appUrl = getTelegramAppBaseUrl();
  const allowInline = isTelegramInlineButtonUrlAllowed(`${appUrl}/`);
  const sourceLabels: Record<string, Record<string, string>> = {
    de: { human: "Echt", ai: "KI" },
    en: { human: "Real", ai: "AI" },
  };

  let text = `${t("model_list_title", locale)}\n\n`;
  const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const plainUrls: string[] = [];

  for (const m of models.slice(0, 10)) {
    const sourceLabel = sourceLabels[locale]?.[m.source ?? "human"] ?? m.source ?? "–";
    text += t("model_list_item", locale, {
      name: escapeMarkdown(m.displayName),
      source: sourceLabel,
    }) + "\n\n";

    const u = `${appUrl}/${locale}/dashboard/human-models/${m.id}`;
    if (allowInline) {
      buttons.push([{ text: `👤 ${m.displayName.slice(0, 30)}`, url: u }]);
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

export async function sendBackgroundList(
  chatId: number,
  user: UserDoc,
): Promise<void> {
  const locale = resolveLocale(user.preferredLocale);
  const backgrounds = await listBackgrounds(user.workspaceId);

  if (backgrounds.length === 0) {
    await sendMessage(chatId, t("bg_list_empty", locale));
    return;
  }

  const appUrl = getTelegramAppBaseUrl();
  const allowInline = isTelegramInlineButtonUrlAllowed(`${appUrl}/`);
  const typeLabels: Record<string, Record<string, string>> = {
    de: { canvas: "Canvas", freestyle: "Freestyle", upload: "Upload" },
    en: { canvas: "Canvas", freestyle: "Freestyle", upload: "Upload" },
  };

  let text = `${t("bg_list_title", locale)}\n\n`;
  const buttons: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  const plainUrls: string[] = [];

  for (const bg of backgrounds.slice(0, 10)) {
    const typeLabel = typeLabels[locale]?.[bg.type ?? "freestyle"] ?? bg.type ?? "–";
    text += t("bg_list_item", locale, {
      name: escapeMarkdown(bg.name),
      type: typeLabel,
    }) + "\n\n";

    const u = `${appUrl}/${locale}/dashboard/backgrounds/${bg.id}`;
    if (allowInline) {
      buttons.push([{ text: `🖼 ${bg.name.slice(0, 30)}`, url: u }]);
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

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
