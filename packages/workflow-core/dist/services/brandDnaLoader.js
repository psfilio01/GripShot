"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBrandDna = loadBrandDna;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
const DEFAULT_BRAND_ID = "aurelea";
/**
 * Loads brand DNA from data/brand/{brandId}/dna.md.
 * Falls back to empty text if file is missing (e.g. for tests).
 */
async function loadBrandDna(dataRoot, brandId = DEFAULT_BRAND_ID) {
    const path = (0, node_path_1.join)(dataRoot, "brand", brandId, "dna.md");
    const exists = await fs_extra_1.default.pathExists(path);
    const text = exists ? await fs_extra_1.default.readFile(path, "utf8") : "";
    const brandName = brandId === "aurelea" ? "AuréLéa" : brandId;
    return {
        brandId,
        brandName,
        text: text.trim()
    };
}
