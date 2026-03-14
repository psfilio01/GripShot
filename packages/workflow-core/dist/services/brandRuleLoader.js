"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBrandRules = loadBrandRules;
const node_path_1 = require("node:path");
const fs_extra_1 = __importDefault(require("fs-extra"));
async function loadBrandRules(product) {
    const brandFilePath = (0, node_path_1.join)(product.basePath, "brand", "brand-rules.json");
    const exists = await fs_extra_1.default.pathExists(brandFilePath);
    if (!exists)
        return null;
    const raw = await fs_extra_1.default.readFile(brandFilePath, "utf8");
    const data = JSON.parse(raw);
    return {
        id: data.id ?? product.id,
        brandName: data.brandName ?? product.name ?? product.id,
        data
    };
}
