import type { Timestamp } from "firebase-admin/firestore";

/** Fields added to every soft-deletable entity. */
export interface SoftDeleteFields {
  deletedAt: Timestamp | null;
  deletedBy: string | null;
}

/** Firestore: users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  workspaceId: string;
  /** When set, logged-in app navigation uses this locale (see middleware). */
  preferredLocale?: "en" | "de";
  /** Telegram chat ID bound via /start → settings link flow. */
  telegramChatId?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{workspaceId} */
export interface WorkspaceDoc {
  name: string;
  ownerUid: string;
  plan: "free" | "starter" | "pro";
  quotaUsed: number;
  quotaLimit: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  defaultHumanModelId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{wid}/brands/{brandId} */
export interface BrandDoc {
  name: string;
  isPrivateLabel: boolean;
  dna: string;
  targetAudience: string;
  productCategory: string;
  tone: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{wid}/humanModels/{modelId} */
export interface HumanModelDoc extends SoftDeleteFields {
  displayName: string;
  notes: string;
  source?: "human" | "ai";
  aiPrompt?: string;
  gender?: string;
  ageRange?: string;
  bodyBuild?: string;
  ethnicity?: string;
  hairColor?: string;
  hairLength?: string;
  skinTone?: string;
  height?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{wid}/backgrounds/{backgroundId} */
export interface BackgroundDoc extends SoftDeleteFields {
  name: string;
  type: "canvas" | "freestyle" | "upload";
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{wid}/products/{productId} */
export interface ProductDoc extends SoftDeleteFields {
  name: string;
  brandId: string;
  category: string;
  description: string;
  status: "draft" | "active" | "archived";
  colors?: ProductColorEntry[];
  /** User's raw freestyle prompt block (any language). */
  userPromptBlockRaw?: string;
  /** Compiled English prompt block, validated by Gemini. Used in generation. */
  userPromptBlockCompiled?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductColorEntry {
  id: string;
  name: string;
  hex: string;
  notes?: string;
  sku?: string;
}

/** Firestore: workspaces/{wid}/jobs/{jobId} */
export interface JobDoc {
  productId: string;
  workflowType: string;
  status: "pending" | "running" | "completed" | "failed";
  promptSnapshot: string;
  resultPaths: string[];
  createdAt: Timestamp;
  completedAt: Timestamp | null;
}

/** Firestore: workspaces/{wid}/workflows/{workflowId} */
export interface WorkflowDoc extends SoftDeleteFields {
  userId: string;
  workspaceId: string;
  name: string;
  description: string;
  status: "draft" | "planned" | "in_progress" | "completed";
  globalSettings: WorkflowGlobalSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkflowGlobalSettings {
  modelId?: string;
  backgroundId?: string;
  outfit?: string;
  language?: string;
  /** Default aspect ratio for image steps (e.g. 4:5). */
  aspectRatio?: string;
  /** Default resolution / quality tier (e.g. 2K, 4K). */
  resolution?: string;
  /** Gemini image model id (allowlisted). */
  imageModel?: string;
  /** Last selected product on the workflow screen (persisted per workflow). */
  productId?: string;
}

/** A single color variant generated via Hero Lock for a workflow step image. */
export interface WorkflowStepColorVariant {
  colorId: string;
  colorName: string;
  colorHex: string;
  imagePath: string;
  status: "pending" | "completed" | "failed";
}

/** Firestore: workspaces/{wid}/workflows/{workflowId}/steps/{stepId} */
export interface WorkflowStepDoc {
  index: number;
  type: "image" | "text" | "image_with_text";
  title: string;
  description: string;
  promptConfig: Record<string, unknown>;
  status: "planned" | "generating" | "completed" | "failed";
  resultImagePath?: string;
  /** 4K upscaled version of resultImagePath (via Real-ESRGAN). */
  upscaledImagePath?: string;
  resultText?: string;
  /** Set when the step's generated image is soft-deleted (image only, step persists). */
  resultImageDeletedAt?: Timestamp | null;
  resultImageDeletedBy?: string | null;
  /** Color variants generated via Hero Lock recolor. */
  colorVariants?: WorkflowStepColorVariant[];
  createdAt: Timestamp;
}

/** A single step definition stored inside a template (no result data). */
export interface WorkflowTemplateStep {
  index: number;
  type: "image" | "text" | "image_with_text";
  title: string;
  description: string;
  promptConfig: Record<string, unknown>;
}

/** Firestore: workspaces/{wid}/workflowTemplates/{templateId} */
export interface WorkflowTemplateDoc {
  name: string;
  description: string;
  globalSettings: WorkflowGlobalSettings;
  steps: WorkflowTemplateStep[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
