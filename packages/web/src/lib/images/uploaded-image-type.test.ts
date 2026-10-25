import { describe, expect, it } from "vitest";
import { detectUploadedImageType } from "./uploaded-image-type";

describe("detectUploadedImageType", () => {
  it("detects PNG, JPEG and WebP signatures", () => {
    expect(
      detectUploadedImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toEqual({ extension: "png", contentType: "image/png" });
    expect(detectUploadedImageType(Buffer.from([0xff, 0xd8, 0xff]))).toEqual({
      extension: "jpg",
      contentType: "image/jpeg",
    });
    expect(
      detectUploadedImageType(Buffer.from("RIFF0000WEBP", "ascii")),
    ).toEqual({ extension: "webp", contentType: "image/webp" });
  });

  it("rejects unsupported or disguised files", () => {
    expect(detectUploadedImageType(Buffer.from("<svg></svg>"))).toBeNull();
    expect(detectUploadedImageType(Buffer.alloc(0))).toBeNull();
  });
});
