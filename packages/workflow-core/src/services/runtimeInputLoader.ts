import fs from "fs-extra";
import { join } from "node:path";

/**
 * Runtime input from OpenClaw (or manual execution).
 * All fields are optional; present values are layered into the prompt.
 */
export interface RuntimeInput {
  pose?: string;
  gaze?: string;
  outfit?: string;
  feet_style?: string;
  background_style?: string;
  composition_goal?: string;
  mood?: string;
  framing?: string;
  /** Arbitrary extra prompt hints that don't fit a named field. */
  extra?: string;
  /** Allow future fields without breaking the loader. */
  [key: string]: string | undefined;
}

const RUNTIME_DIR = "runtime";
const RUNTIME_FILE = "run_input.json";

/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns null if the file doesn't exist — the app falls back to defaults.
 */
export async function loadRuntimeInput(dataRoot: string): Promise<RuntimeInput | null> {
  const filePath = join(dataRoot, "..", RUNTIME_DIR, RUNTIME_FILE);
  const exists = await fs.pathExists(filePath);
  if (!exists) return null;

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const result: RuntimeInput = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim().length > 0) {
      result[key] = value.trim();
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
