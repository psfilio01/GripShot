import type { ProductColorDef, ProductRecolorPolicy } from "@fashionmentum/workflow-core";
import type { ProductDoc } from "@/lib/db/types";

/** Capture authoritative settings once so edits during a run cannot change later colors. */
export function snapshotProductRecolorSettings(
  product: Pick<ProductDoc, "colors" | "recolorAllComponents" | "recolorInstructions" | "userPromptBlockRaw" | "userPromptBlockCompiled">,
  selectedColorIds?: string[],
): { targetColors: ProductColorDef[]; recolorPolicy: ProductRecolorPolicy } {
  const colors = product.colors ?? [];
  const selected = selectedColorIds ? new Set(selectedColorIds) : null;
  if (selected && [...selected].some((id) => !colors.some((color) => color.id === id))) {
    throw new Error("A selected color no longer belongs to this product. Reload the product colors.");
  }
  return {
    targetColors: colors.filter((color) => !selected || selected.has(color.id)).map((color) => ({
      id: color.id,
      name: color.name,
      hex: color.hex,
      ...(color.notes?.trim() ? { notes: color.notes.trim() } : {}),
    })),
    recolorPolicy: {
      allComponentsFollowTargetColor: product.recolorAllComponents ?? false,
      instructions: product.recolorInstructions?.trim() ?? "",
      // Raw text retains product facts a previous compiler might have removed.
      productInstructions: product.userPromptBlockRaw?.trim() || product.userPromptBlockCompiled?.trim() || "",
    },
  };
}
