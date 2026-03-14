import { nanoid } from "nanoid";
import type { WorkflowType } from "../types/api";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";
import type { ReferenceImage } from "./referenceImageLoader";
import type { BuiltPrompt } from "../domain/prompt";

interface BuildPromptArgs {
  workflowType: WorkflowType;
  product: Product;
  brandRules: BrandRules | null;
  references: ReferenceImage[];
}

export function buildPrompt(args: BuildPromptArgs): BuiltPrompt {
  const { workflowType, product, brandRules, references } = args;

  // Very simple neutral product shot prompt for MVP.
  const brandName = brandRules?.brandName ?? product.name ?? product.id;

  const referenceHint =
    references.length > 0 ? "Use the provided reference images as guidance." : "No reference images available.";

  const text = [
    `High quality neutral product shot of a ${product.name ?? product.id}.`,
    `Brand: ${brandName}.`,
    "Plain, clean background suitable for ecommerce.",
    referenceHint
  ].join(" ");

  return {
    id: nanoid(),
    templateId: "neutral_product_shot_v1",
    templateVersion: 1,
    workflowType,
    text
  };
}

