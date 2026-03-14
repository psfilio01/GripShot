import fg from "fast-glob";
import { join } from "node:path";
import type { Product } from "../domain/product";

export interface ReferenceImage {
  path: string;
}

export async function loadReferenceImages(product: Product): Promise<ReferenceImage[]> {
  const referenceDir = join(product.basePath, "reference");
  const patterns = ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"];
  const files = await fg(patterns, { cwd: referenceDir, absolute: true });
  return files.map((path) => ({ path }));
}

