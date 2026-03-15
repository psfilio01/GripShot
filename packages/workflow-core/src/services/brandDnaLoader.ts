import fs from "fs-extra";
import { join } from "node:path";

const DEFAULT_BRAND_ID = "aurelea";

export interface BrandDna {
  brandId: string;
  brandName: string;
  /** Full DNA text for prompt injection */
  text: string;
}

/**
 * Loads brand DNA from data/brand/{brandId}/dna.md.
 * Falls back to empty text if file is missing (e.g. for tests).
 */
export async function loadBrandDna(dataRoot: string, brandId = DEFAULT_BRAND_ID): Promise<BrandDna> {
  const path = join(dataRoot, "brand", brandId, "dna.md");
  const exists = await fs.pathExists(path);
  const text = exists ? await fs.readFile(path, "utf8") : "";
  const brandName = brandId === "aurelea" ? "AuréLéa" : brandId;
  return {
    brandId,
    brandName,
    text: text.trim()
  };
}
