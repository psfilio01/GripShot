/** Shared with the browser; keep Node-only image inspection in upload-validation. */
export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
// One image plus multipart fields/headers, below Cloud Run's 32 MiB HTTP/1 limit.
export const MAX_IMAGE_UPLOAD_REQUEST_BYTES = 26 * 1024 * 1024;

export function assertImageUploadSize(file: Pick<File, "size" | "name">): void {
  if (file.size === 0) throw new Error(`File ${file.name} is empty.`);
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`File ${file.name} exceeds the 25 MB limit.`);
  }
}
