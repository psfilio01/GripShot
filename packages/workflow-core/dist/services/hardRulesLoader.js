"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGlobalHardRules = loadGlobalHardRules;
exports.loadProductHardRules = loadProductHardRules;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
/**
 * Load global brand hard rules from data/brand/aurelea/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
async function loadGlobalHardRules(dataRoot) {
    const filePath = (0, node_path_1.join)(dataRoot, "brand", "aurelea", "hard-rules.md");
    return loadMarkdownRules(filePath, "global");
}
/**
 * Load product-specific hard rules from data/products/<id>/hard-rules.md.
 * Returns null if the file doesn't exist.
 */
async function loadProductHardRules(product) {
    const filePath = (0, node_path_1.join)(product.basePath, "hard-rules.md");
    return loadMarkdownRules(filePath, "product");
}
async function loadMarkdownRules(filePath, source) {
    const exists = await fs_extra_1.default.pathExists(filePath);
    if (!exists)
        return null;
    const text = (await fs_extra_1.default.readFile(filePath, "utf8")).trim();
    if (text.length === 0)
        return null;
    return { text, source };
}
