"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    WORKFLOW_DATA_ROOT: zod_1.z
        .string()
        .nonempty()
        .default(process.cwd() + "/data"),
    NANOBANANA_API_KEY: zod_1.z.string().nonempty().optional(),
    NANOBANANA_BASE_URL: zod_1.z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
    NANOBANANA_MODEL: zod_1.z.string().default("gemini-3.1-flash-image-preview"),
    /** When "true", skip the real API call and use the reference image as output (for local testing when API is unreachable). */
    NANOBANANA_DRY_RUN: zod_1.z
        .string()
        .optional()
        .transform((v) => v === "true" || v === "1")
});
let cachedEnv = null;
function getEnv() {
    if (!cachedEnv) {
        cachedEnv = EnvSchema.parse(process.env);
    }
    return cachedEnv;
}
