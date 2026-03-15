"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listModels = listModels;
exports.loadModelReferences = loadModelReferences;
exports.pickRandomModelId = pickRandomModelId;
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
/**
 * Lists all model IDs (subfolders of data/models/ that contain a reference/ folder with images).
 */
async function listModels(dataRoot) {
    const modelsDir = (0, node_path_1.join)(dataRoot, "models");
    const exists = await fs_extra_1.default.pathExists(modelsDir);
    if (!exists)
        return [];
    const entries = await fs_extra_1.default.readdir(modelsDir, { withFileTypes: true });
    const ids = [];
    for (const e of entries) {
        if (!e.isDirectory())
            continue;
        const refDir = (0, node_path_1.join)(modelsDir, e.name, "reference");
        if (!(await fs_extra_1.default.pathExists(refDir)))
            continue;
        const files = await (0, fast_glob_1.default)(["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"], {
            cwd: refDir,
            absolute: true
        });
        if (files.length > 0)
            ids.push(e.name);
    }
    return ids.sort();
}
/**
 * Loads reference image paths for a given model.
 */
async function loadModelReferences(dataRoot, modelId) {
    const refDir = (0, node_path_1.join)(dataRoot, "models", modelId, "reference");
    const exists = await fs_extra_1.default.pathExists(refDir);
    if (!exists)
        return [];
    const patterns = ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"];
    const files = await (0, fast_glob_1.default)(patterns, { cwd: refDir, absolute: true });
    return files.map((path) => ({ path }));
}
/**
 * Picks a random model ID from available models, or undefined if none.
 */
function pickRandomModelId(modelIds) {
    if (modelIds.length === 0)
        return undefined;
    return modelIds[Math.floor(Math.random() * modelIds.length)];
}
