"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRuntimeInput = loadRuntimeInput;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
// ---------------------------------------------------------------------------
// Generation settings (resolution / aspect ratio)
// ---------------------------------------------------------------------------
const ALLOWED_RESOLUTIONS = ["512", "1K", "2K", "4K"];
const ALLOWED_ASPECT_RATIOS = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
    "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
];
const DEFAULT_GENERATION_SETTINGS = {
    resolution: "2K",
    aspectRatio: "4:5"
};
/** Normalise user input like "2k" → "2K", "4k" → "4K". */
function normaliseResolution(raw) {
    const upper = raw.trim().toUpperCase();
    return upper === "0.5K" ? "512" : upper;
}
function isValidResolution(v) {
    return ALLOWED_RESOLUTIONS.includes(v);
}
function isValidAspectRatio(v) {
    return ALLOWED_ASPECT_RATIOS.includes(v.trim());
}
const RUNTIME_DIR = "runtime";
const RUNTIME_FILE = "run_input.json";
/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns prompt-level fields in `input` and generation settings (with defaults) in `generationSettings`.
 */
async function loadRuntimeInput(dataRoot) {
    const filePath = (0, node_path_1.join)(dataRoot, "..", RUNTIME_DIR, RUNTIME_FILE);
    const exists = await fs_extra_1.default.pathExists(filePath);
    if (!exists) {
        return { input: null, generationSettings: { ...DEFAULT_GENERATION_SETTINGS } };
    }
    const raw = await fs_extra_1.default.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    // Extract prompt-level string fields
    const promptFields = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (key === "generation")
            continue;
        if (typeof value === "string" && value.trim().length > 0) {
            promptFields[key] = value.trim();
        }
    }
    // Extract and validate generation settings
    const genRaw = parsed.generation;
    const settings = { ...DEFAULT_GENERATION_SETTINGS };
    if (genRaw && typeof genRaw === "object") {
        if (typeof genRaw.resolution === "string") {
            const norm = normaliseResolution(genRaw.resolution);
            if (isValidResolution(norm)) {
                settings.resolution = norm;
            }
            else {
                console.warn(`Grip Shot: invalid resolution "${genRaw.resolution}", using default "${settings.resolution}". Allowed: ${ALLOWED_RESOLUTIONS.join(", ")}`);
            }
        }
        if (typeof genRaw.aspectRatio === "string") {
            const ar = genRaw.aspectRatio.trim();
            if (isValidAspectRatio(ar)) {
                settings.aspectRatio = ar;
            }
            else {
                console.warn(`Grip Shot: invalid aspectRatio "${genRaw.aspectRatio}", using default "${settings.aspectRatio}". Allowed: ${ALLOWED_ASPECT_RATIOS.join(", ")}`);
            }
        }
    }
    const input = Object.keys(promptFields).length > 0 ? promptFields : null;
    return { input, generationSettings: settings };
}
