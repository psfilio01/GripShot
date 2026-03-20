import type { Timestamp } from "firebase-admin/firestore";

/** Firestore: users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  workspaceId: string;
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

/** Firestore: workspaces/{wid}/products/{productId} */
export interface ProductDoc {
  name: string;
  brandId: string;
  category: string;
  description: string;
  status: "draft" | "active" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
