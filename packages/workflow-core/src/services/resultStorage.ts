import fs from "fs-extra";
import path from "node:path";
import { join } from "node:path";
import type { Product } from "../domain/product";
import { getEnv } from "../config/env";
import {
  copyDataObject,
  deleteDataObject,
  putDataObject,
  usesGcsBlobStorage,
} from "./objectStorage";

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

function generatedObjectKey(
  productId: string,
  jobId: string,
  bucket: Bucket,
  imageId: string,
  extension: string,
): string {
  return `generated/${productId}/${jobId}/${bucket}/${imageId}.${extension}`;
}

function extFromPath(filePath: string): string {
  return filePath.split(".").pop() ?? "png";
}

export async function storeImage(args: StoreImageArgs): Promise<string> {
  const { product, jobId, bucket, imageId, extension = "png", buffer } = args;

  if (usesGcsBlobStorage()) {
    const key = generatedObjectKey(product.id, jobId, bucket, imageId, extension);
    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    await putDataObject(key, buffer, contentType);
    return key;
  }

  const dataRoot = getEnv().WORKFLOW_DATA_ROOT;
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
  imageId: string,
): Promise<string> {
  const ext = extFromPath(currentPath);

  if (usesGcsBlobStorage()) {
    const destKey = generatedObjectKey(productId, jobId, targetBucket, imageId, ext);
    const srcKey = path.isAbsolute(currentPath)
      ? null
      : currentPath;
    if (!srcKey) {
      throw new Error("GCS mode: variant filePath must be an object key, not a local path");
    }
    await copyDataObject(srcKey, destKey);
    await deleteDataObject(srcKey);
    return destKey;
  }

  const dataRoot = getEnv().WORKFLOW_DATA_ROOT;
  const generatedRoot = getGeneratedRoot(dataRoot);
  const targetDir = join(generatedRoot, productId, jobId, targetBucket);
  await fs.ensureDir(targetDir);
  const targetPath = join(targetDir, `${imageId}.${ext}`);

  await fs.move(currentPath, targetPath, { overwrite: true });
  return targetPath;
}
