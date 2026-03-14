import fs from "fs-extra";
import { join } from "node:path";
import { getEnv } from "../config/env";
import type { ImageJob } from "../domain/imageJob";
import type { ImageVariant } from "../domain/imageVariant";

interface MetadataFile {
  jobs: ImageJob[];
  variants: ImageVariant[];
}

let inMemory: MetadataFile | null = null;

function getMetadataFilePath(): string {
  const { WORKFLOW_DATA_ROOT } = getEnv();
  return join(WORKFLOW_DATA_ROOT, "metadata.json");
}

async function loadStore(): Promise<MetadataFile> {
  if (inMemory) return inMemory;
  const path = getMetadataFilePath();
  const exists = await fs.pathExists(path);
  if (!exists) {
    inMemory = { jobs: [], variants: [] };
    return inMemory;
  }

  const raw = await fs.readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<MetadataFile>;
  inMemory = {
    jobs: parsed.jobs ?? [],
    variants: parsed.variants ?? []
  };
  return inMemory;
}

async function saveStore(data: MetadataFile): Promise<void> {
  const path = getMetadataFilePath();
  await fs.ensureFile(path);
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

export const metadataStore = {
  async insertJob(job: ImageJob): Promise<void> {
    const store = await loadStore();
    store.jobs.push(job);
    await saveStore(store);
  },

  async updateJobStatus(jobId: string, status: ImageJob["status"]): Promise<void> {
    const store = await loadStore();
    const job = store.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      await saveStore(store);
    }
  },

  async getJob(jobId: string): Promise<ImageJob | null> {
    const store = await loadStore();
    return store.jobs.find((j) => j.id === jobId) ?? null;
  },

  async insertVariant(variant: ImageVariant): Promise<void> {
    const store = await loadStore();
    store.variants.push(variant);
    await saveStore(store);
  },

  async updateVariantStatus(variantId: string, status: ImageVariant["status"]): Promise<void> {
    const store = await loadStore();
    const v = store.variants.find((x) => x.id === variantId);
    if (v) {
      v.status = status;
      await saveStore(store);
    }
  },

  async listVariantsForJob(jobId: string): Promise<ImageVariant[]> {
    const store = await loadStore();
    return store.variants.filter((v) => v.jobId === jobId);
  },

  async getVariantById(id: string): Promise<ImageVariant | null> {
    const store = await loadStore();
    return store.variants.find((v) => v.id === id) ?? null;
  }
};


