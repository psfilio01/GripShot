import { imageSize } from "image-size";
import { detectUploadedImageType } from "./uploaded-image-type";
import {
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_REQUEST_BYTES,
} from "./upload-limits";

export class ImageUploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/** Bound the actual stream, not only an optional/untrusted Content-Length header. */
export async function readImageUploadFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new ImageUploadError("Use multipart/form-data to upload an image.");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new ImageUploadError("Invalid Content-Length.");
  }
  if (length !== null && Number(length) > MAX_IMAGE_UPLOAD_REQUEST_BYTES) {
    await request.body?.cancel().catch(() => {});
    throw new ImageUploadError("Upload request exceeds the 26 MB limit. Upload one image at a time.", 413);
  }
  if (!request.body) throw new ImageUploadError("No upload body provided.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_UPLOAD_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        throw new ImageUploadError("Upload request exceeds the 26 MB limit. Upload one image at a time.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return await new Response(Buffer.concat(chunks, total), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new ImageUploadError("Invalid multipart upload.");
  }
}

/** All upload APIs accept exactly one file, including unexpected field names. */
export function getSingleImageUpload(form: FormData, field: string): File {
  const files = [...form.values()].filter((entry): entry is File => entry instanceof File);
  const entries = form.getAll(field);
  if (files.length !== 1 || entries.length !== 1 || !(entries[0] instanceof File)) {
    throw new ImageUploadError("Upload exactly one image per request.");
  }
  return entries[0];
}

/** Inspect signatures and raster metadata; this intentionally does not decode/re-encode pixels. */
export async function validateImageUpload(file: File) {
  if (file.size === 0) throw new ImageUploadError("Select a non-empty image file.");
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ImageUploadError("The image exceeds the 25 MB limit.", 413);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const imageType = detectUploadedImageType(buffer);
  if (!imageType) {
    throw new ImageUploadError("Unsupported image. Use a valid JPEG, PNG, or WebP file.");
  }
  let width: number;
  let height: number;
  try {
    ({ width, height } = imageSize(buffer));
  } catch {
    throw new ImageUploadError("Invalid image dimensions. Use a valid JPEG, PNG, or WebP file.");
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new ImageUploadError("Invalid image dimensions.");
  }
  if (width > MAX_IMAGE_PIXELS / height) {
    throw new ImageUploadError("Image exceeds the 25 megapixel limit.");
  }
  return { buffer, imageType, width, height };
}

/** Keep the original name where possible, but match its extension to the verified bytes. */
export function imageUploadFileName(name: string, extension: "jpg" | "png" | "webp"): string {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  const matching = extension === "jpg" ? /\.jpe?g$/i : new RegExp(`\\.${extension}$`, "i");
  if (sanitized && sanitized.length <= 200 && matching.test(sanitized)) return sanitized;
  const stem = sanitized.replace(/\.[^.]*$/, "").slice(0, 190) || "image";
  return `${stem}.${extension}`;
}
