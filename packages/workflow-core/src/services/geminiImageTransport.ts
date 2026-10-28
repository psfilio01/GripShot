import axios from "axios";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

/** Conservative JSON budget, including base64, prompt, schema and generation config. */
export const GEMINI_INLINE_REQUEST_BUDGET = 16 * 1024 * 1024;
const PREPARATION_TIMEOUT_MS = 120_000;
const CLEANUP_TIMEOUT_MS = 10_000;

export type GeminiImagePart =
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { mime_type: string; file_uri: string } };

interface ReferenceImage {
  buffer: Buffer;
  mimeType: string;
}

interface TransportOptions {
  apiKey: string;
  baseUrl: string;
  signal?: AbortSignal;
  /** UTF-8 JSON byte size of the complete request with its image parts omitted. */
  requestOverheadBytes: number;
}

interface ProviderFile {
  name?: string;
  uri?: string;
  state?: string;
}

function filesBaseUrl(configuredBaseUrl: string): URL {
  let base: URL;
  try {
    base = new URL(configuredBaseUrl);
  } catch {
    throw new Error("Invalid Gemini API base URL.");
  }
  // Do not silently route large files around a configured proxy to another provider.
  if (
    base.origin !== "https://generativelanguage.googleapis.com" ||
    !/^\/v1(?:beta)?\/?$/.test(base.pathname) ||
    base.username || base.password || base.search || base.hash
  ) {
    throw new Error("Large reference images require the official HTTPS Gemini API base URL (Files API support).");
  }
  base.pathname = base.pathname.replace(/\/$/, "");
  return base;
}

function validatedUploadUrl(value: unknown, base: URL): string {
  if (typeof value !== "string" || value.length > 4096) {
    throw new Error("Gemini Files API did not return a valid upload URL.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Gemini Files API did not return a valid upload URL.");
  }
  if (url.origin !== base.origin || !url.pathname.startsWith("/upload/") || url.username || url.password || url.hash) {
    throw new Error("Gemini Files API returned an untrusted upload URL.");
  }
  return url.toString();
}

/**
 * Preserve originals without recompression. Small requests retain their existing inline
 * representation; oversized references use the provider's resumable Files API instead.
 * Provider copies are scoped to this call and deleted even when generation fails/cancels.
 * https://ai.google.dev/gemini-api/docs/files
 */
export async function withGeminiImageParts<T>(
  images: ReferenceImage[],
  options: TransportOptions,
  useParts: (parts: GeminiImagePart[]) => Promise<T>,
): Promise<T> {
  options.signal?.throwIfAborted();
  if (!Number.isSafeInteger(options.requestOverheadBytes) || options.requestOverheadBytes < 0 || options.requestOverheadBytes > GEMINI_INLINE_REQUEST_BUDGET) {
    throw new Error("Gemini prompt and configuration exceed the request size budget.");
  }
  const inlineSizes = images.map(({ buffer, mimeType }) =>
    Buffer.byteLength(JSON.stringify({ inline_data: { mime_type: mimeType, data: "" } })) +
    4 * Math.ceil(buffer.length / 3) + 1,
  );
  let estimatedSize = options.requestOverheadBytes + inlineSizes.reduce((total, bytes) => total + bytes, 0);
  const uploadIndexes = new Set<number>();
  for (const index of images.map((_, index) => index).sort((a, b) => inlineSizes[b]! - inlineSizes[a]!)) {
    if (estimatedSize <= GEMINI_INLINE_REQUEST_BUDGET) break;
    uploadIndexes.add(index);
    // The validated provider URI is short; reserve more than its serialized part requires.
    estimatedSize -= inlineSizes[index]! - 512;
  }
  if (estimatedSize > GEMINI_INLINE_REQUEST_BUDGET) {
    throw new Error("Gemini references and prompt exceed the request size budget.");
  }

  const base = uploadIndexes.size ? filesBaseUrl(options.baseUrl) : undefined;
  const uploadedNames = new Set<string>();
  const timeout = uploadIndexes.size ? AbortSignal.timeout(PREPARATION_TIMEOUT_MS) : undefined;
  const signal = timeout ? (options.signal ? AbortSignal.any([options.signal, timeout]) : timeout) : options.signal;
  const apiHeaders = { "x-goog-api-key": options.apiKey };

  const upload = async (image: ReferenceImage): Promise<GeminiImagePart> => {
    const name = `files/gs-${randomUUID().replace(/-/g, "")}`;
    const resourceUrl = `${base!.href}/${name}`;
    try {
      const started = await axios.post(
        `${base!.origin}/upload${base!.pathname}/files`,
        { file: { name, display_name: "GripShot reference" } },
        {
          headers: {
            ...apiHeaders,
            "Content-Type": "application/json",
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(image.buffer.length),
            "X-Goog-Upload-Header-Content-Type": image.mimeType,
          },
          signal,
          timeout: PREPARATION_TIMEOUT_MS,
          maxRedirects: 0,
        },
      );
      // The client-chosen name also permits cleanup if finalization's response is lost.
      uploadedNames.add(name);
      const uploadUrl = validatedUploadUrl(started.headers["x-goog-upload-url"], base!);
      const finalized = await axios.post(uploadUrl, image.buffer, {
        headers: {
          "Content-Type": image.mimeType,
          "Content-Length": String(image.buffer.length),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        signal,
        timeout: PREPARATION_TIMEOUT_MS,
        maxBodyLength: image.buffer.length,
        maxRedirects: 0,
      });
      let file = finalized.data?.file as ProviderFile | undefined;
      while (file?.name === name && file.state === "PROCESSING") {
        await delay(500, undefined, { signal });
        const status = await axios.get(resourceUrl, {
          headers: apiHeaders, signal, timeout: PREPARATION_TIMEOUT_MS, maxRedirects: 0,
        });
        file = status.data as ProviderFile;
      }
      if (file?.name !== name || file.uri !== resourceUrl || file.state !== "ACTIVE") {
        throw new Error("Gemini reference upload was not ready for generation.");
      }
      return { file_data: { mime_type: image.mimeType, file_uri: file.uri } };
    } catch (error) {
      if (signal?.aborted) signal.throwIfAborted();
      // Never propagate Axios configs, signed upload URLs, response bodies or credentials.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Gemini reference upload failed${status ? ` (HTTP ${status})` : ""}. Please retry or check Files API access.`);
    }
  };

  try {
    const parts: GeminiImagePart[] = [];
    // Sequential preparation bounds memory and preserves product/background/model order.
    for (let index = 0; index < images.length; index++) {
      signal?.throwIfAborted();
      const image = images[index]!;
      parts.push(uploadIndexes.has(index)
        ? await upload(image)
        : { inline_data: { mime_type: image.mimeType, data: image.buffer.toString("base64") } });
    }
    const actualSize = options.requestOverheadBytes + parts.reduce((total, part) => total + Buffer.byteLength(JSON.stringify(part)) + 1, 0);
    if (actualSize > GEMINI_INLINE_REQUEST_BUDGET) throw new Error("Gemini request exceeds the request size budget.");
    options.signal?.throwIfAborted();
    return await useParts(parts);
  } finally {
    await Promise.all([...uploadedNames].map(async (name) => {
      try {
        await axios.delete(`${base!.href}/${name}`, {
          headers: apiHeaders,
          // A cancelled generation must not cancel deletion of its uploaded references.
          signal: AbortSignal.timeout(CLEANUP_TIMEOUT_MS),
          timeout: CLEANUP_TIMEOUT_MS,
          maxRedirects: 0,
        });
      } catch {
        // Best effort: the provider automatically expires files after 48 hours.
        console.warn("Gemini temporary reference cleanup failed; the provider copy will expire automatically.");
      }
    }));
  }
}
