"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataStore = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const node_path_1 = require("node:path");
const env_1 = require("../config/env");
let inMemory = null;
function getMetadataFilePath() {
    const { WORKFLOW_DATA_ROOT } = (0, env_1.getEnv)();
    return (0, node_path_1.join)(WORKFLOW_DATA_ROOT, "metadata.json");
}
async function loadStore() {
    if (inMemory)
        return inMemory;
    const path = getMetadataFilePath();
    const exists = await fs_extra_1.default.pathExists(path);
    if (!exists) {
        inMemory = { jobs: [], variants: [] };
        return inMemory;
    }
    const raw = await fs_extra_1.default.readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    inMemory = {
        jobs: parsed.jobs ?? [],
        variants: parsed.variants ?? []
    };
    return inMemory;
}
async function saveStore(data) {
    const path = getMetadataFilePath();
    await fs_extra_1.default.ensureFile(path);
    await fs_extra_1.default.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}
exports.metadataStore = {
    async insertJob(job) {
        const store = await loadStore();
        store.jobs.push(job);
        await saveStore(store);
    },
    async updateJobStatus(jobId, status) {
        const store = await loadStore();
        const job = store.jobs.find((j) => j.id === jobId);
        if (job) {
            job.status = status;
            job.updatedAt = new Date().toISOString();
            await saveStore(store);
        }
    },
    async getJob(jobId) {
        const store = await loadStore();
        return store.jobs.find((j) => j.id === jobId) ?? null;
    },
    async insertVariant(variant) {
        const store = await loadStore();
        store.variants.push(variant);
        await saveStore(store);
    },
    async updateVariantStatus(variantId, status) {
        const store = await loadStore();
        const v = store.variants.find((x) => x.id === variantId);
        if (v) {
            v.status = status;
            await saveStore(store);
        }
    },
    async listVariantsForJob(jobId) {
        const store = await loadStore();
        return store.variants.filter((v) => v.jobId === jobId);
    },
    async getVariantById(id) {
        const store = await loadStore();
        return store.variants.find((v) => v.id === id) ?? null;
    }
};
