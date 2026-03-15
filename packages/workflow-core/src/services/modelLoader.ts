import fg from "fast-glob";
import fs from "fs-extra";
import { join } from "node:path";

export interface ModelReference {
  path: string;
}

/**
 * Lists all model IDs (subfolders of data/models/ that contain a reference/ folder with images).
 */
export async function listModels(dataRoot: string): Promise<string[]> {
  const modelsDir = join(dataRoot, "models");
  const exists = await fs.pathExists(modelsDir);
  if (!exists) return [];

  const entries = await fs.readdir(modelsDir, { withFileTypes: true });
  const ids: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const refDir = join(modelsDir, e.name, "reference");
    if (!(await fs.pathExists(refDir))) continue;
    const files = await fg(["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"], {
      cwd: refDir,
      absolute: true
    });
    if (files.length > 0) ids.push(e.name);
  }
  return ids.sort();
}

/**
 * Loads reference image paths for a given model.
 */
export async function loadModelReferences(dataRoot: string, modelId: string): Promise<ModelReference[]> {
  const refDir = join(dataRoot, "models", modelId, "reference");
  const exists = await fs.pathExists(refDir);
  if (!exists) return [];

  const patterns = ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"];
  const files = await fg(patterns, { cwd: refDir, absolute: true });
  return files.map((path) => ({ path }));
}

/**
 * Picks a random model ID from available models, or undefined if none.
 */
export function pickRandomModelId(modelIds: string[]): string | undefined {
  if (modelIds.length === 0) return undefined;
  return modelIds[Math.floor(Math.random() * modelIds.length)];
}
