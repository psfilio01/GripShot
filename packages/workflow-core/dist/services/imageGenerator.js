"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImagesWithNanoBanana = generateImagesWithNanoBanana;
const axios_1 = __importDefault(require("axios"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../config/env");
const MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif"
};
function mimeFromPath(filePath) {
    const ext = node_path_1.default.extname(filePath).replace(/^\./, "").toLowerCase();
    return MIME_BY_EXT[ext] ?? "image/jpeg";
}
/**
 * Generate images via Gemini. Reference images are sent in order (product refs, optional background, optional model).
 * Single path or array of paths supported.
 */
async function generateImagesWithNanoBanana(prompt, referenceImagePaths, generationSettings) {
    const paths = Array.isArray(referenceImagePaths) ? referenceImagePaths : [referenceImagePaths];
    const { NANOBANANA_API_KEY, NANOBANANA_BASE_URL, NANOBANANA_MODEL, NANOBANANA_DRY_RUN } = (0, env_1.getEnv)();
    if (NANOBANANA_DRY_RUN) {
        const first = paths[0];
        if (!first)
            throw new Error("At least one reference image path is required.");
        const imageBuffer = await fs_extra_1.default.readFile(first);
        const ext = node_path_1.default.extname(first).replace(/^\./, "") || "jpg";
        return [{ buffer: imageBuffer, extension: ext }];
    }
    if (!NANOBANANA_API_KEY) {
        throw new Error("Nano Banana API key not configured.");
    }
    const parts = [
        { text: prompt.text ?? "" }
    ];
    for (const p of paths) {
        const buffer = await fs_extra_1.default.readFile(p);
        parts.push({
            inline_data: {
                mime_type: mimeFromPath(p),
                data: buffer.toString("base64")
            }
        });
    }
    const url = `${NANOBANANA_BASE_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`;
    const imageConfig = generationSettings
        ? { aspectRatio: generationSettings.aspectRatio, imageSize: generationSettings.resolution }
        : undefined;
    try {
        const response = await axios_1.default.post(url, {
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                ...(imageConfig && { imageConfig })
            }
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 240000
        });
        const outParts = response.data?.candidates?.[0]?.content?.parts ?? [];
        console.log("Gemini response finishReason:", response.data?.candidates?.[0]?.finishReason);
        console.log("Gemini response parts (truncated):", JSON.stringify(outParts, null, 2).slice(0, 2000));
        const images = outParts
            .filter((part) => part.inlineData?.mimeType?.startsWith("image/") || part.inline_data?.mime_type?.startsWith("image/"))
            .map((part) => {
            const mimeType = part.inlineData?.mimeType ?? part.inline_data?.mime_type;
            const data = part.inlineData?.data ?? part.inline_data?.data;
            const extension = mimeType.split("/")[1] ?? "png";
            const buffer = Buffer.from(data, "base64");
            return { buffer, extension };
        });
        if (images.length === 0) {
            console.error("Gemini response contained no image parts.", {
                finishReason: response.data?.candidates?.[0]?.finishReason
            });
            throw new Error("Gemini response contained no images.");
        }
        return images;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const statusText = error.response?.statusText;
            const data = error.response?.data;
            const finishReason = data?.candidates?.[0]?.finishReason;
            const respParts = data?.candidates?.[0]?.content?.parts;
            console.error("Gemini API request failed.", {
                status,
                statusText,
                data: typeof data === "string" ? data.slice(0, 2000) : data,
                finishReason,
                partsPreview: respParts != null ? JSON.stringify(respParts, null, 2).slice(0, 2000) : undefined
            });
        }
        else {
            console.error("Unexpected error when calling Gemini API.", error);
        }
        throw error;
    }
}
