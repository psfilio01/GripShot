"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadReferenceImages = loadReferenceImages;
const fast_glob_1 = __importDefault(require("fast-glob"));
const node_path_1 = require("node:path");
async function loadReferenceImages(product) {
    const referenceDir = (0, node_path_1.join)(product.basePath, "reference");
    const patterns = ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"];
    const files = await (0, fast_glob_1.default)(patterns, { cwd: referenceDir, absolute: true });
    return files.map((path) => ({ path }));
}
