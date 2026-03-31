import fg from "fast-glob";
import { join } from "node:path";
import type { Product } from "../domain/product";
import { listDataObjectKeys, usesGcsBlobStorage } from "./objectStorage";

export interface ReferenceImage {
  path: string;
}

const REF_IMAGE = /\.(png|jpg|jpeg|webp)$/i;

export async function loadReferenceImages(product: Product): Promise<ReferenceImage[]> {
  if (usesGcsBlobStorage()) {
    const prefix = `products/${product.id}/reference/`;
    const keys = await listDataObjectKeys(prefix);
    return keys
      .filter(
        (k) =>
          REF_IMAGE.test(k) &&
          !k.endsWith("/.metadata.json") &&
          !k.split("/").pop()?.startsWith("."),
      )
      .sort()
      .map((pathKey) => ({ path: pathKey }));
  }

  const referenceDir = join(product.basePath, "reference");
  const patterns = ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"];
  const files = await fg(patterns, { cwd: referenceDir, absolute: true });
  return files.map((pathKey) => ({ path: pathKey }));
}
