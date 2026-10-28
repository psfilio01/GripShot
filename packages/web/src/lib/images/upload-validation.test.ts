import { describe, expect, it, vi } from "vitest";
import {
  getSingleImageUpload, imageUploadFileName, readImageUploadFormData, validateImageUpload,
} from "./upload-validation";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_REQUEST_BYTES } from "./upload-limits";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6P90AAAAASUVORK5CYII=", "base64");
const file = (bytes = png) => new File([bytes], "product.png", { type: "image/png" });
const multipartRequest = (form: FormData) => new Request("http://localhost/upload", { method: "POST", body: form });

describe("bounded multipart image requests", () => {
  it("parses a normal multipart file and text fields", async () => {
    const body = new FormData();
    body.append("files", file());
    body.append("category", "primary");
    const parsed = await readImageUploadFormData(multipartRequest(body));
    expect(parsed.get("category")).toBe("primary");
    expect(getSingleImageUpload(parsed, "files").name).toBe("product.png");
  });

  it("rejects oversized Content-Length without reading the body", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST", body: "small", headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(MAX_IMAGE_UPLOAD_REQUEST_BYTES + 1),
      },
    });
    await expect(readImageUploadFormData(request)).rejects.toMatchObject({ status: 413 });
    expect(request.bodyUsed).toBe(true);
  });

  it.each([undefined, "1"])("rejects a chunked oversized stream even when Content-Length is %s", async (length) => {
    let sent = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel,
    }, { highWaterMark: 0 });
    const headers: Record<string, string> = { "content-type": "multipart/form-data; boundary=x" };
    if (length) headers["content-length"] = length;
    const request = new Request("http://localhost/upload", { method: "POST", body, headers, duplex: "half" } as RequestInit);
    await expect(readImageUploadFormData(request)).rejects.toMatchObject({ status: 413 });
    expect(sent).toBe(27);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects invalid multipart data and header values", async () => {
    const make = (headers: Record<string, string>) => new Request("http://localhost/upload", { method: "POST", body: "bad", headers });
    await expect(readImageUploadFormData(make({ "content-type": "application/json" }))).rejects.toMatchObject({ status: 400 });
    await expect(readImageUploadFormData(make({ "content-type": "multipart/form-data; boundary=x", "content-length": "invalid" }))).rejects.toMatchObject({ status: 400 });
    await expect(readImageUploadFormData(make({ "content-type": "multipart/form-data; boundary=x" }))).rejects.toMatchObject({ status: 400 });
  });

  it.each(["files", "unexpected"])("rejects an extra file in %s before persistence", (extraField) => {
    const body = new FormData();
    body.append("files", file());
    body.append(extraField, file());
    expect(() => getSingleImageUpload(body, "files")).toThrow("exactly one");
  });

  it("rejects absent files, text substituted for files, and duplicate expected fields", () => {
    const body = new FormData();
    expect(() => getSingleImageUpload(body, "files")).toThrow("exactly one");
    body.append("files", "not a file");
    expect(() => getSingleImageUpload(body, "files")).toThrow("exactly one");
    body.append("files", file());
    expect(() => getSingleImageUpload(body, "files")).toThrow("exactly one");
  });
});

describe("uploaded image signature and metadata limits", () => {
  it("preserves original bytes and trusts the signature instead of declared MIME", async () => {
    const result = await validateImageUpload(new File([png], "spoof.jpg", { type: "image/jpeg" }));
    expect(result).toMatchObject({ width: 1, height: 1, imageType: { extension: "png", contentType: "image/png" } });
    expect(result.buffer.equals(png)).toBe(true);
    expect(imageUploadFileName("spoof.jpg", "png")).toBe("spoof.png");
  });

  it("accepts up to exactly 25 MiB without shrinking or re-encoding", async () => {
    const bytes = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES);
    png.copy(bytes);
    const result = await validateImageUpload(file(bytes));
    expect(result.buffer.length).toBe(MAX_IMAGE_UPLOAD_BYTES);
    expect(result.buffer.equals(bytes)).toBe(true);
  });

  it("rejects a 25 MiB + 1 file before allocating its array buffer", async () => {
    const arrayBuffer = vi.fn();
    await expect(validateImageUpload({ size: MAX_IMAGE_UPLOAD_BYTES + 1, arrayBuffer } as unknown as File)).rejects.toMatchObject({ status: 413 });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects empty, spoofed, and truncated signature-only files", async () => {
    await expect(validateImageUpload(file(Buffer.alloc(0)))).rejects.toMatchObject({ status: 400 });
    await expect(validateImageUpload(file(Buffer.from("<svg/>")))).rejects.toThrow("Unsupported image");
    await expect(validateImageUpload(file(png.subarray(0, 8)))).rejects.toThrow("Invalid image dimensions");
    await expect(validateImageUpload(file(Buffer.from([0xff, 0xd8, 0xff])))).rejects.toThrow("Invalid image dimensions");
    await expect(validateImageUpload(file(Buffer.from("RIFF0000WEBP")))).rejects.toThrow("Invalid image dimensions");
  });

  it("accepts a declared 25 MP raster and rejects larger or zero dimensions", async () => {
    // Metadata-only inspection: these altered headers are not claimed to be decoded PNGs.
    const bytes = Buffer.from(png);
    bytes.writeUInt32BE(5000, 16);
    bytes.writeUInt32BE(5000, 20);
    expect(await validateImageUpload(file(bytes))).toMatchObject({ width: 5000, height: 5000 });
    bytes.writeUInt32BE(5001, 16);
    await expect(validateImageUpload(file(bytes))).rejects.toThrow("25 megapixel");
    bytes.writeUInt32BE(0, 16);
    await expect(validateImageUpload(file(bytes))).rejects.toThrow("Invalid image dimensions");
  });

  it("does not permit path names or mismatched stored extensions", () => {
    expect(imageUploadFileName("../../image.jpg", "png")).toBe("_.._image.png");
    expect(imageUploadFileName("..", "jpg")).toBe("image.jpg");
    expect(imageUploadFileName("photo.jpeg", "jpg")).toBe("photo.jpeg");
  });
});
