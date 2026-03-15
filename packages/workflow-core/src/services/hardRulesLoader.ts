import fs from "fs-extra";
import { join } from "node:path";
import type { Product } from "../domain/product";

export interface HardRules {
  /** Markdown text with non-negotiable constraints. */
  text: string;
  source: "global" | "product";
}

/**
 * Load global brand hard rules from data/brand/aurelea/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
export async function loadGlobalHardRules(dataRoot: string): Promise<HardRules | null> {
  const filePath = join(dataRoot, "brand", "aurelea", "hard-rules.md");
  return loadMarkdownRules(filePath, "global");
}

/**
 * Load product-specific hard rules from data/products/<id>/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
export async function loadProductHardRules(product: Product): Promise<HardRules | null> {
  const filePath = join(product.basePath, "hard-rules.md");
  return loadMarkdownRules(filePath, "product");
}

async function loadMarkdownRules(
  filePath: string,
  source: "global" | "product"
): Promise<HardRules | null> {
  const exists = await fs.pathExists(filePath);
  if (!exists) return null;

  const text = (await fs.readFile(filePath, "utf8")).trim();
  if (text.length === 0) return null;

  return { text, source };
}
