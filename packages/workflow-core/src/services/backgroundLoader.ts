import fg from "fast-glob";
import fs from "fs-extra";
import { join } from "node:path";

export interface BackgroundReference {
  path: string;
}

const GOLDEN_BACKGROUND_NAME = "golden";

/**
 * Loads the golden background reference image for AuréLéa.
 * Looks for data/brand/aurelea/backgrounds/golden.* (jpg, png, etc.).
 */
export async function loadGoldenBackground(dataRoot: string): Promise<BackgroundReference | null> {
  const dir = join(dataRoot, "brand", "aurelea", "backgrounds");
  const exists = await fs.pathExists(dir);
  if (!exists) return null;

  const files = await fg([`${GOLDEN_BACKGROUND_NAME}.*`], { cwd: dir, absolute: true });
  if (files.length === 0) return null;
  return { path: files[0] };
}

/**
 * Loads a user-managed background image by id.
 * Looks for data/backgrounds/{backgroundId}/* (first image found).
 */
export async function loadUserBackground(
  dataRoot: string,
  backgroundId: string,
): Promise<BackgroundReference | null> {
  const dir = join(dataRoot, "backgrounds", backgroundId);
  const exists = await fs.pathExists(dir);
  if (!exists) return null;

  const files = await fg(["*.{jpg,jpeg,png,webp}"], { cwd: dir, absolute: true });
  if (files.length === 0) return null;
  return { path: files[0] };
}
