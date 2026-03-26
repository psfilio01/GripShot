import type { Timestamp } from "firebase-admin/firestore";

/** Firestore: users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  workspaceId: string;
  /** When set, logged-in app navigation uses this locale (see middleware). */
  preferredLocale?: "en" | "de";
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
export interface HumanModelDoc {
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
export interface BackgroundDoc {
  name: string;
  type: "canvas" | "freestyle" | "upload";
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore: workspaces/{wid}/products/{productId} */
export interface ProductDoc {
  name: string;
  brandId: string;
  category: string;
  description: string;
  status: "draft" | "active" | "archived";
  colors?: ProductColorEntry[];
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
