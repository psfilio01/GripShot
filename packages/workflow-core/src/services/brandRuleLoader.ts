import { join } from "node:path";
import fs from "fs-extra";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";

export async function loadBrandRules(product: Product): Promise<BrandRules | null> {
  const brandFilePath = join(product.basePath, "brand", "brand-rules.json");
  const exists = await fs.pathExists(brandFilePath);
  if (!exists) return null;

  const raw = await fs.readFile(brandFilePath, "utf8");
  const data = JSON.parse(raw) as { id?: string; brandName?: string } & Record<string, unknown>;

  return {
    id: data.id ?? product.id,
    brandName: data.brandName ?? product.name ?? product.id,
    data
  };
}

