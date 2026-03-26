export const PRODUCT_CATEGORIES = [
  "handheld",
  "wearable",
  "furniture",
  "outdoor",
  "kitchen",
  "beauty",
  "decor",
  "fitness",
  "generic",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface CategoryProfile {
  /** Relative size class: small items held in hand vs room-scale furniture. */
  typicalScale: "small" | "medium" | "large";
  /** Whether lifestyle shots typically include a person interacting with the product. */
  showWithPerson: boolean;
  /** Whether close-up / detail shots add value for this category. */
  detailShotsRelevant: boolean;
  /** Whether material, texture, and finish deserve special prompt emphasis. */
  materialFocus: boolean;
  /** Whether the product benefits from environmental / contextual scenes. */
  contextNeeded: boolean;
}

export const CATEGORY_PROFILES: Record<ProductCategory, CategoryProfile> = {
  handheld: {
    typicalScale: "small",
    showWithPerson: true,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: false,
  },
  wearable: {
    typicalScale: "small",
    showWithPerson: true,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: false,
  },
  furniture: {
    typicalScale: "large",
    showWithPerson: false,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: true,
  },
  outdoor: {
    typicalScale: "large",
    showWithPerson: true,
    detailShotsRelevant: false,
    materialFocus: false,
    contextNeeded: true,
  },
  kitchen: {
    typicalScale: "medium",
    showWithPerson: true,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: true,
  },
  beauty: {
    typicalScale: "small",
    showWithPerson: true,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: false,
  },
  decor: {
    typicalScale: "medium",
    showWithPerson: false,
    detailShotsRelevant: true,
    materialFocus: true,
    contextNeeded: true,
  },
  fitness: {
    typicalScale: "medium",
    showWithPerson: true,
    detailShotsRelevant: false,
    materialFocus: false,
    contextNeeded: false,
  },
  generic: {
    typicalScale: "medium",
    showWithPerson: false,
    detailShotsRelevant: false,
    materialFocus: false,
    contextNeeded: false,
  },
};

/**
 * Returns the category profile for the given category, falling back to `generic`.
 */
export function getCategoryProfile(category?: ProductCategory): CategoryProfile {
  return CATEGORY_PROFILES[category ?? "generic"];
}

export interface Product {
  id: string;
  name?: string;
  /**
   * Root folder for this product, e.g. <DATA_ROOT>/products/pilates-mini-ball
   */
  basePath: string;
  /** Product category for prompt routing and composition selection. Defaults to `generic`. */
  category?: ProductCategory;
}

export function buildProductFromId(
  productId: string,
  dataRoot: string,
  category?: ProductCategory,
): Product {
  return {
    id: productId,
    name: productId,
    basePath: `${dataRoot}/products/${productId}`,
    category,
  };
}

