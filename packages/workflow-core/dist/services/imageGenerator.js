"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImagesWithNanoBanana = generateImagesWithNanoBanana;
const axios_1 = __importDefault(require("axios"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const env_1 = require("../config/env");
async function generateImagesWithNanoBanana(prompt, referenceImagePath) {
    const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_MODEL, NANOBANANA_DRY_RUN } = (0, env_1.getEnv)();
    if (NANOBANANA_DRY_RUN) {
        const imageBuffer = await fs_extra_1.default.readFile(referenceImagePath);
        return [{ buffer: imageBuffer, extension: "jpg" }];
    }
    if (!NANOBANANA_API_KEY) {
        throw new Error("Nano Banana API key not configured.");
    }
    // Read and base64-encode the reference image
    const imageBuffer = await fs_extra_1.default.readFile(referenceImagePath);
    const imageBase64 = imageBuffer.toString("base64");
    // Gemini API: POST to generateContent with API key as query param (not Bearer token)
    const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;
    const response = await axios_1.default.post(url, {
        contents: [
            {
                parts: [
                    {
                        text: prompt.text ?? ""
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageBase64
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ["IMAGE", "TEXT"]
        }
    }, {
        headers: {
            "Content-Type": "application/json"
        }
    });
    // Gemini returns images as base64 inline_data inside parts
    const parts = response.data?.candidates?.[0]?.content?.parts ?? [];
    const images = parts
        .filter((part) => part.inline_data?.mime_type?.startsWith("image/"))
        .map((part) => {
        const mimeType = part.inline_data.mime_type; // e.g. "image/png"
        const extension = mimeType.split("/")[1] ?? "png";
        const buffer = Buffer.from(part.inline_data.data, "base64");
        return { buffer, extension };
    });
    if (images.length === 0) {
        throw new Error("Gemini response contained no images.");
    }
    return images;
}
