"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGoldenBackground = loadGoldenBackground;
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
const GOLDEN_BACKGROUND_NAME = "golden";
/**
 * Loads the golden background reference image for AuréLéa.
 * Looks for data/brand/aurelea/backgrounds/golden.* (jpg, png, etc.).
 */
async function loadGoldenBackground(dataRoot) {
    const dir = (0, node_path_1.join)(dataRoot, "brand", "aurelea", "backgrounds");
    const exists = await fs_extra_1.default.pathExists(dir);
    if (!exists)
        return null;
    const files = await (0, fast_glob_1.default)([`${GOLDEN_BACKGROUND_NAME}.*`], { cwd: dir, absolute: true });
    if (files.length === 0)
        return null;
    return { path: files[0] };
}
