import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: {
  post: vi.fn(), get: vi.fn(), delete: vi.fn(), isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
} }));
import axios from "axios";
import { GEMINI_INLINE_REQUEST_BUDGET, withGeminiImageParts } from "./geminiImageTransport";

const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
const options = { apiKey: "private-test-key", baseUrl, requestOverheadBytes: 1000 };
const image = (mib: number) => ({ buffer: Buffer.alloc(mib * 1024 * 1024, 23), mimeType: "image/png" });
let names: string[];

function mockUploads() {
  vi.mocked(axios.post).mockImplementation(async (url, body) => {
    if (url === "https://generativelanguage.googleapis.com/upload/v1beta/files") {
      const name = body.file.name as string;
      names.push(name);
      return { headers: { "x-goog-upload-url": `https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=${names.length}` } };
    }
    return { data: { file: { name: names.at(-1), uri: `${baseUrl}/${names.at(-1)}`, state: "ACTIVE" } } };
  });
}

describe("Gemini original-image transport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    names = [];
    vi.mocked(axios.delete).mockResolvedValue({});
    mockUploads();
  });

  it("keeps small inline images byte-identical and makes no Files API calls", async () => {
    const original = Buffer.from([0, 255, 8, 17]);
    const result = await withGeminiImageParts([{ buffer: original, mimeType: "image/jpeg" }], options, async parts => {
      expect(parts).toEqual([{ inline_data: { mime_type: "image/jpeg", data: original.toString("base64") } }]);
      return "generated";
    });
    expect(result).toBe("generated");
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it("uploads a 25 MiB original unchanged and deletes it after use", async () => {
    const original = image(25);
    await withGeminiImageParts([original], options, async parts => {
      expect(parts).toEqual([{ file_data: { mime_type: "image/png", file_uri: `${baseUrl}/${names[0]}` } }]);
      expect(axios.delete).not.toHaveBeenCalled();
    });
    expect(vi.mocked(axios.post).mock.calls[1][1]).toBe(original.buffer);
    expect(vi.mocked(axios.post).mock.calls[1][2]?.headers).not.toHaveProperty("x-goog-api-key");
    expect(axios.delete).toHaveBeenCalledWith(`${baseUrl}/${names[0]}`, expect.objectContaining({ timeout: 10000, maxRedirects: 0 }));
  });

  it("accounts for aggregate base64 size, preserves order, and uploads only the largest necessary reference", async () => {
    const refs = [image(5), image(9), image(1)];
    await withGeminiImageParts(refs, options, async parts => {
      expect(parts[0]).toHaveProperty("inline_data");
      expect(parts[1]).toHaveProperty("file_data");
      expect(parts[2]).toHaveProperty("inline_data");
      expect(Buffer.byteLength(JSON.stringify(parts)) + options.requestOverheadBytes).toBeLessThan(GEMINI_INLINE_REQUEST_BUDGET);
    });
    expect(names).toHaveLength(1);
    expect(vi.mocked(axios.post).mock.calls[1][1]).toBe(refs[1].buffer);
  });

  it("counts prompt and schema bytes when deciding whether to upload", async () => {
    await withGeminiImageParts([image(10)], { ...options, requestOverheadBytes: 3 * 1024 * 1024 }, async parts => {
      expect(parts[0]).toHaveProperty("file_data");
    });
    expect(names).toHaveLength(1);
  });

  it("rejects oversized prompt/config before provider requests", async () => {
    await expect(withGeminiImageParts([image(1)], { ...options, requestOverheadBytes: GEMINI_INLINE_REQUEST_BUDGET + 1 }, vi.fn())).rejects.toThrow("prompt and configuration");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("cleans provider copies when generation fails without masking the original error", async () => {
    const failure = new Error("generation failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(axios.delete).mockRejectedValue(new Error("cleanup failed"));
    await expect(withGeminiImageParts([image(13)], options, async () => { throw failure; })).rejects.toBe(failure);
    expect(axios.delete).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("expire automatically"));
    warn.mockRestore();
  });

  it("cleans with an independent bounded signal after the caller cancels", async () => {
    const controller = new AbortController();
    await expect(withGeminiImageParts([image(13)], { ...options, signal: controller.signal }, async () => {
      controller.abort();
      controller.signal.throwIfAborted();
    })).rejects.toMatchObject({ name: "AbortError" });
    const cleanupConfig = vi.mocked(axios.delete).mock.calls[0][1]!;
    expect(cleanupConfig.signal).not.toBe(controller.signal);
    expect(cleanupConfig.signal?.aborted).toBe(false);
    expect(cleanupConfig.timeout).toBe(10000);
  });

  it("does no IO for an already cancelled request", async () => {
    await expect(withGeminiImageParts([image(13)], { ...options, signal: AbortSignal.abort() }, vi.fn())).rejects.toMatchObject({ name: "AbortError" });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("cleans earlier uploaded files when a later upload fails without exposing credentials", async () => {
    const initialMock = vi.mocked(axios.post).getMockImplementation()!;
    vi.mocked(axios.post).mockImplementation(async (...args) => {
      if (names.length === 1 && typeof args[1]?.file === "object") {
        throw { isAxiosError: true, response: { status: 403, data: options.apiKey }, message: `secret ${options.apiKey}` };
      }
      return initialMock(...args);
    });
    const action = withGeminiImageParts([image(13), image(13)], options, vi.fn());
    await expect(action).rejects.toThrow("HTTP 403");
    await expect(action).rejects.not.toThrow(options.apiKey);
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it("deletes the known resource if finalize fails or its response is lost", async () => {
    const initialMock = vi.mocked(axios.post).getMockImplementation()!;
    vi.mocked(axios.post).mockImplementation(async (...args) => {
      if (Buffer.isBuffer(args[1])) throw new Error("lost response");
      return initialMock(...args);
    });
    await expect(withGeminiImageParts([image(13)], options, vi.fn())).rejects.toThrow("reference upload failed");
    expect(axios.delete).toHaveBeenCalledWith(`${baseUrl}/${names[0]}`, expect.anything());
  });

  it("rejects custom or insecure base URLs instead of rerouting originals", async () => {
    for (const base of ["https://proxy.example/v1beta", "http://generativelanguage.googleapis.com/v1beta", `${baseUrl}?key=secret`]) {
      await expect(withGeminiImageParts([image(13)], { ...options, baseUrl: base }, vi.fn())).rejects.toThrow("official HTTPS Gemini");
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("never sends original bytes to an untrusted resumable URL or follows redirects", async () => {
    vi.mocked(axios.post).mockResolvedValue({ headers: { "x-goog-upload-url": "https://attacker.example/upload/data" } });
    await expect(withGeminiImageParts([image(13)], options, vi.fn())).rejects.toThrow("reference upload failed");
    expect(axios.post).toHaveBeenCalledOnce();
    expect(vi.mocked(axios.post).mock.calls[0][2]?.maxRedirects).toBe(0);
    expect(axios.delete).toHaveBeenCalledOnce();
  });

  it("waits for PROCESSING files to become ACTIVE before generation", async () => {
    const initialMock = vi.mocked(axios.post).getMockImplementation()!;
    vi.mocked(axios.post).mockImplementation(async (...args) => {
      const response = await initialMock(...args);
      if (response.data?.file) response.data.file.state = "PROCESSING";
      return response;
    });
    vi.mocked(axios.get).mockImplementation(async () => ({ data: { name: names[0], uri: `${baseUrl}/${names[0]}`, state: "ACTIVE" } }));
    await withGeminiImageParts([image(13)], options, async parts => expect(parts[0]).toHaveProperty("file_data"));
    expect(axios.get).toHaveBeenCalledOnce();
  });
});
