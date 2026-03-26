import { describe, it, expect } from "vitest";
import type {
  UserDoc,
  WorkspaceDoc,
  BrandDoc,
  ProductDoc,
  JobDoc,
} from "./types";

describe("Firestore document types", () => {
  it("UserDoc satisfies the expected shape", () => {
    const user: Partial<UserDoc> = {
      uid: "abc123",
      email: "test@example.com",
      displayName: "Test User",
      workspaceId: "ws_1",
      preferredLocale: "de",
    };
    expect(user.uid).toBe("abc123");
    expect(user.workspaceId).toBe("ws_1");
    expect(user.preferredLocale).toBe("de");
  });

  it("WorkspaceDoc has quota fields", () => {
    const ws: Partial<WorkspaceDoc> = {
      name: "My workspace",
      plan: "free",
      quotaUsed: 5,
      quotaLimit: 50,
    };
    expect(ws.quotaLimit! - ws.quotaUsed!).toBe(45);
  });

  it("WorkspaceDoc plan is a valid union", () => {
    const plans: WorkspaceDoc["plan"][] = ["free", "starter", "pro"];
    expect(plans).toHaveLength(3);
  });

  it("ProductDoc status is a valid union", () => {
    const statuses: ProductDoc["status"][] = ["draft", "active", "archived"];
    expect(statuses).toHaveLength(3);
  });

  it("JobDoc status is a valid union", () => {
    const statuses: JobDoc["status"][] = [
      "pending",
      "running",
      "completed",
      "failed",
    ];
    expect(statuses).toHaveLength(4);
  });

  it("BrandDoc includes expected fields", () => {
    const brand: Partial<BrandDoc> = {
      name: "AuréLéa",
      isPrivateLabel: true,
      dna: "quiet luxury",
      targetAudience: "women 25-40",
    };
    expect(brand.isPrivateLabel).toBe(true);
  });
});
