import fs from "fs-extra";
import { join } from "node:path";

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

const KNOWN_CATEGORY = new Set<string>(PRODUCT_CATEGORIES);

/**
 * Maps Firestore / API category strings to a known {@link ProductCategory}.
 * Unknown or legacy free-text values (e.g. "Pilates Accessories") fall back to `generic`.
 */
export function normalizeProductCategory(raw?: string | null): ProductCategory {
  if (raw == null || String(raw).trim() === "") return "generic";
  const key = String(raw).trim().toLowerCase();
  return KNOWN_CATEGORY.has(key) ? (key as ProductCategory) : "generic";
}

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
 * Returns the category profile for the given category, falling back to `generic`
 * when missing or not a known slug (handles legacy Firestore free-text).
 */
export function getCategoryProfile(category?: string | null): CategoryProfile {
  const key = normalizeProductCategory(category);
  return CATEGORY_PROFILES[key] ?? CATEGORY_PROFILES.generic;
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
  categoryRaw?: string | null,
): Product {
  const category =
    categoryRaw != null && String(categoryRaw).trim() !== ""
      ? normalizeProductCategory(categoryRaw)
      : undefined;
  return {
    id: productId,
    name: productId,
    basePath: `${dataRoot}/products/${productId}`,
    category,
  };
}

/**
 * Shape of `category-profile.json` stored inside a product folder.
 * Every field is optional — only specified fields override the built-in defaults.
 */
export interface CategoryProfileJson {
  category?: string;
  typicalScale?: "small" | "medium" | "large";
  showWithPerson?: boolean;
  detailShotsRelevant?: boolean;
  materialFocus?: boolean;
  contextNeeded?: boolean;
}

export interface LoadedCategoryProfile {
  category: ProductCategory;
  profile: CategoryProfile;
  source: "json" | "default";
}

/**
 * Reads `category-profile.json` from the product folder and merges with
 * the built-in category defaults. Falls back to `generic` when the file
 * is missing or unparsable.
 */
export async function loadProductCategoryProfile(
  productBasePath: string,
): Promise<LoadedCategoryProfile> {
  const filePath = join(productBasePath, "category-profile.json");
  const exists = await fs.pathExists(filePath);

  if (!exists) {
    return {
      category: "generic",
      profile: CATEGORY_PROFILES.generic,
      source: "default",
    };
  }

  let json: CategoryProfileJson;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    json = JSON.parse(raw) as CategoryProfileJson;
  } catch {
    return {
      category: "generic",
      profile: CATEGORY_PROFILES.generic,
      source: "default",
    };
  }

  const category = normalizeProductCategory(json.category);
  const base = CATEGORY_PROFILES[category];

  const profile: CategoryProfile = {
    typicalScale: json.typicalScale ?? base.typicalScale,
    showWithPerson: json.showWithPerson ?? base.showWithPerson,
    detailShotsRelevant: json.detailShotsRelevant ?? base.detailShotsRelevant,
    materialFocus: json.materialFocus ?? base.materialFocus,
    contextNeeded: json.contextNeeded ?? base.contextNeeded,
  };

  return { category, profile, source: "json" };
}

