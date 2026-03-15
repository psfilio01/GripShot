"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRuntimeInput = loadRuntimeInput;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
const RUNTIME_DIR = "runtime";
const RUNTIME_FILE = "run_input.json";
/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns null if the file doesn't exist — the app falls back to defaults.
 */
async function loadRuntimeInput(dataRoot) {
    const filePath = (0, node_path_1.join)(dataRoot, "..", RUNTIME_DIR, RUNTIME_FILE);
    const exists = await fs_extra_1.default.pathExists(filePath);
    if (!exists)
        return null;
    const raw = await fs_extra_1.default.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const result = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.trim().length > 0) {
            result[key] = value.trim();
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}
