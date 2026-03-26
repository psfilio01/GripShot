import type { WorkflowType } from "../types/api";
import type { ProductCategory } from "./product";

export interface QualityScore {
  overallScore: number;
  productVisible: boolean;
  proportionsPlausible: boolean;
  goalMet: boolean;
  issues: string[];
}

export interface QualityScorerInput {
  imagePath: string;
  workflowType: WorkflowType;
  productCategory?: ProductCategory;
  productName?: string;
}

/**
 * JSON Schema for Gemini structured output when scoring generated images.
 * Used with responseMimeType: "application/json" on text-only models.
 */
export const QUALITY_SCORE_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    overallScore: {
      type: "number" as const,
      description:
        "Overall quality score from 1 (unusable) to 10 (perfect). " +
        "Consider product visibility, proportions, goal adherence, and visual quality.",
    },
    productVisible: {
      type: "boolean" as const,
      description:
        "Whether the main product is clearly visible and recognisable in the image.",
    },
    proportionsPlausible: {
      type: "boolean" as const,
      description:
        "Whether the product's proportions and scale appear physically realistic " +
        "relative to any people, hands, or objects in the scene.",
    },
    goalMet: {
      type: "boolean" as const,
      description:
        "Whether the image fulfils its stated generation goal " +
        "(e.g. white-background hero, lifestyle in use, scale reference, detail close-up, A+ visual).",
    },
    issues: {
      type: "array" as const,
      items: { type: "string" as const },
      description:
        "List of specific issues found. Empty array if no issues. " +
        "Examples: 'product partially occluded', 'background not pure white', 'unrealistic hand pose'.",
    },
  },
  required: [
    "overallScore",
    "productVisible",
    "proportionsPlausible",
    "goalMet",
    "issues",
  ],
};
