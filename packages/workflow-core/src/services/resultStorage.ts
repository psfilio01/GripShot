import fs from "fs-extra";
import { join } from "node:path";
import type { Product } from "../domain/product";

export type Bucket = "neutral" | "favorites" | "rejected" | "variants";

export interface StoreImageArgs {
  product: Product;
  jobId: string;
  bucket: Bucket;
  imageId: string;
  extension?: string;
  buffer: Buffer;
}

export function getGeneratedRoot(dataRoot: string): string {
  return join(dataRoot, "generated");
}

export async function storeImage(args: StoreImageArgs): Promise<string> {
  const { product, jobId, bucket, imageId, extension = "png", buffer } = args;
  const dataRoot = process.env.WORKFLOW_DATA_ROOT ?? process.cwd() + "/data";
  const generatedRoot = getGeneratedRoot(dataRoot);
  const dir = join(generatedRoot, product.id, jobId, bucket);
  await fs.ensureDir(dir);

  const filePath = join(dir, `${imageId}.${extension}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function moveImage(
  currentPath: string,
  targetBucket: Bucket,
  productId: string,
  jobId: string,
  imageId: string
): Promise<string> {
  const dataRoot = process.env.WORKFLOW_DATA_ROOT ?? process.cwd() + "/data";
  const generatedRoot = getGeneratedRoot(dataRoot);
  const ext = currentPath.split(".").pop() ?? "png";
  const targetDir = join(generatedRoot, productId, jobId, targetBucket);
  await fs.ensureDir(targetDir);
  const targetPath = join(targetDir, `${imageId}.${ext}`);

  await fs.move(currentPath, targetPath, { overwrite: true });
  return targetPath;
}

