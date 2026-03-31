import fg from "fast-glob";
import fs from "fs-extra";
import { join } from "node:path";
import { listDataObjectKeys, usesGcsBlobStorage } from "./objectStorage";

export interface BackgroundReference {
  path: string;
}

const GOLDEN_BACKGROUND_NAME = "golden";

const USER_BG = /\.(jpg|jpeg|png|webp)$/i;

/**
 * Loads the golden background reference image for AuréLéa.
 * Looks for data/brand/aurelea/backgrounds/golden.* (jpg, png, etc.).
 */
export async function loadGoldenBackground(
  dataRoot: string,
): Promise<BackgroundReference | null> {
  if (usesGcsBlobStorage()) {
    const prefix = "brand/aurelea/backgrounds/";
    const keys = await listDataObjectKeys(prefix);
    const golden = keys.find(
      (k) =>
        USER_BG.test(k) &&
        k.split("/").pop()?.toLowerCase().startsWith(`${GOLDEN_BACKGROUND_NAME}.`),
    );
    return golden ? { path: golden } : null;
  }

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
  if (usesGcsBlobStorage()) {
    const prefix = `backgrounds/${backgroundId}/`;
    const keys = (await listDataObjectKeys(prefix))
      .filter((k) => USER_BG.test(k))
      .sort();
    const first = keys[0];
    return first ? { path: first } : null;
  }

  const dir = join(dataRoot, "backgrounds", backgroundId);
  const exists = await fs.pathExists(dir);
  if (!exists) return null;

  const files = await fg(["*.{jpg,jpeg,png,webp}"], { cwd: dir, absolute: true });
  if (files.length === 0) return null;
  return { path: files[0] };
}
