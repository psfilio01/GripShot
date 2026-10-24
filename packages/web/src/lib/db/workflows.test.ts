import { describe, it, expect } from "vitest";
import { z } from "zod";

const WorkflowGlobalSettingsSchema = z.object({
  productId: z.string().max(128).optional(),
  modelId: z.string().max(200).optional(),
  backgroundId: z.string().max(200).optional(),
  outfit: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
});

const CreateWorkflowSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    globalSettings: WorkflowGlobalSettingsSchema.default({}),
  })
  .superRefine((data, ctx) => {
    const pid = data.globalSettings.productId?.trim();
    if (!pid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product is required",
        path: ["globalSettings", "productId"],
      });
    }
  });

const WorkflowStepSchema = z.object({
  index: z.number().int().min(0),
  type: z.enum(["image", "text", "image_with_text"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  promptConfig: z.record(z.unknown()),
  status: z.enum(["planned", "generating", "completed", "failed"]),
});

describe("CreateWorkflowSchema validation", () => {
  it("accepts a valid workflow with all fields", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Full Amazon Listing",
      description: "Create hero shot, lifestyle images, and listing copy",
      globalSettings: {
        productId: "prod-1",
        modelId: "model-123",
        backgroundId: "bg-456",
        outfit: "Black Pilates outfit",
        language: "English",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Full Amazon Listing");
      expect(result.data.globalSettings.modelId).toBe("model-123");
    }
  });

  it("rejects workflow without productId", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Quick Listing",
      description: "Just a hero shot and copy",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal body when globalSettings includes productId", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Quick Listing",
      description: "Just a hero shot and copy",
      globalSettings: { productId: "prod-xyz" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.globalSettings.productId).toBe("prod-xyz");
    }
  });

  it("rejects empty name", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "",
      description: "Something",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Valid Name",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "A".repeat(201),
      description: "Valid description",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 5000 chars", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Valid",
      description: "A".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = CreateWorkflowSchema.safeParse({
      description: "Missing name field",
    });
    expect(result.success).toBe(false);
  });

  it("accepts globalSettings with product plus optional fields", () => {
    const result = CreateWorkflowSchema.safeParse({
      name: "Partial Settings",
      description: "Product and language set",
      globalSettings: {
        productId: "prod-1",
        language: "German",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.globalSettings.language).toBe("German");
      expect(result.data.globalSettings.modelId).toBeUndefined();
    }
  });
});

describe("WorkflowStepSchema validation", () => {
  it("accepts a valid image step", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 0,
      type: "image",
      title: "Hero Product Shot",
      description: "Main product image on pure white background",
      promptConfig: { workflowType: "MAIN_IMAGE", aspectRatio: "1:1" },
      status: "planned",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid text step", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 2,
      type: "text",
      title: "Listing Copy",
      description: "SEO-optimized Amazon listing text",
      promptConfig: { workflowType: "NEUTRAL_PRODUCT_SHOT", textPrompt: "Write listing copy" },
      status: "completed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts image_with_text type", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 1,
      type: "image_with_text",
      title: "A+ Content Visual",
      description: "Image with overlay text for A+ content",
      promptConfig: { workflowType: "A_PLUS_VISUAL" },
      status: "generating",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 0,
      type: "video",
      title: "Test",
      description: "Test",
      promptConfig: {},
      status: "planned",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 0,
      type: "image",
      title: "Test",
      description: "Test",
      promptConfig: {},
      status: "running",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative index", () => {
    const result = WorkflowStepSchema.safeParse({
      index: -1,
      type: "image",
      title: "Test",
      description: "Test",
      promptConfig: {},
      status: "planned",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer index", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 1.5,
      type: "image",
      title: "Test",
      description: "Test",
      promptConfig: {},
      status: "planned",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty promptConfig", () => {
    const result = WorkflowStepSchema.safeParse({
      index: 0,
      type: "text",
      title: "Test",
      description: "Test",
      promptConfig: {},
      status: "planned",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["planned", "generating", "completed", "failed"]) {
      const result = WorkflowStepSchema.safeParse({
        index: 0,
        type: "image",
        title: "Test",
        description: "Test",
        promptConfig: {},
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});
