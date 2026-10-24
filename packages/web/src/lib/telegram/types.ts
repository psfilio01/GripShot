/** Subset of Telegram Bot API types used by the webhook handler. */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
  title?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  photo?: TelegramPhotoSize[];
  caption?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface SendMessageParams {
  chat_id: number;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

// ---------------------------------------------------------------------------
// Telegram conversation state (persisted in Firestore)
// ---------------------------------------------------------------------------

export type TelegramStatePhase =
  | "idle"
  | "awaiting_settings"
  | "reviewing_plan"
  | "generating"
  | "reviewing_results"
  | "creating_model"
  | "creating_background"
  | "creating_product";

/** Tracks the sequential step within workflow settings selection. */
export type SettingsStep =
  | "awaiting_description"
  | "confirm_product"
  | "select_model"
  | "select_background"
  | "select_language"
  | "confirm";

export interface TelegramState {
  phase: TelegramStatePhase;
  activeWorkflowId?: string;
  activeStepIndex?: number;
  /** Workflow description text captured before settings are confirmed. */
  pendingDescription?: string;
  /** Partial global settings accumulated via inline-keyboard picks. */
  pendingSettings?: {
    productId?: string;
    modelId?: string;
    backgroundId?: string;
    language?: string;
  };
  /** Gemini-suggested product (Firestore id) before user confirms. */
  workflowSuggestedProductId?: string;
  /** Current step in the sequential settings flow. */
  settingsStep?: SettingsStep;
  /** Message ID of the settings message (for editing in-place). */
  settingsMessageId?: number;
  /** Accumulated data for resource creation (model/background/product). */
  pendingResource?: Record<string, string>;
  /** Current step name within resource creation flow. */
  resourceStep?: string;
  updatedAt: number;
}

export type BotLocale = "de" | "en";

// ---------------------------------------------------------------------------
// Intent classifier
// ---------------------------------------------------------------------------

export type TelegramIntent =
  | "create_workflow"
  | "create_model"
  | "create_background"
  | "create_product"
  | "question"
  | "feedback"
  | "unknown";

export interface ClassifiedIntent {
  intent: TelegramIntent;
  /** Optional cleaned-up description extracted by the classifier. */
  description?: string;
}
