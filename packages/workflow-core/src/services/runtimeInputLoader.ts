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
  extra?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Generation settings (resolution / aspect ratio)
// ---------------------------------------------------------------------------

const ALLOWED_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;
const ALLOWED_ASPECT_RATIOS = [
  "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
  "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
] as const;

export type ImageResolution = (typeof ALLOWED_RESOLUTIONS)[number];
export type AspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];

export interface GenerationSettings {
  resolution: ImageResolution;
  aspectRatio: AspectRatio;
}

const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  resolution: "2K",
  aspectRatio: "4:5"
};

/** Normalise user input like "2k" → "2K", "4k" → "4K". */
function normaliseResolution(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return upper === "0.5K" ? "512" : upper;
}

function isValidResolution(v: string): v is ImageResolution {
  return (ALLOWED_RESOLUTIONS as readonly string[]).includes(v);
}

function isValidAspectRatio(v: string): v is AspectRatio {
  return (ALLOWED_ASPECT_RATIOS as readonly string[]).includes(v.trim());
}

// ---------------------------------------------------------------------------
// Combined loader result
// ---------------------------------------------------------------------------

export interface RuntimeLoadResult {
  input: RuntimeInput | null;
  generationSettings: GenerationSettings;
}

const RUNTIME_DIR = "runtime";
const RUNTIME_FILE = "run_input.json";

/**
 * Load runtime input JSON written by OpenClaw before execution.
 * Returns prompt-level fields in `input` and generation settings (with defaults) in `generationSettings`.
 */
export async function loadRuntimeInput(dataRoot: string): Promise<RuntimeLoadResult> {
  const filePath = join(dataRoot, "..", RUNTIME_DIR, RUNTIME_FILE);
  const exists = await fs.pathExists(filePath);

  if (!exists) {
    return { input: null, generationSettings: { ...DEFAULT_GENERATION_SETTINGS } };
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Extract prompt-level string fields
  const promptFields: RuntimeInput = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "generation") continue;
    if (typeof value === "string" && value.trim().length > 0) {
      promptFields[key] = value.trim();
    }
  }

  // Extract and validate generation settings
  const genRaw = parsed.generation as Record<string, unknown> | undefined;
  const settings: GenerationSettings = { ...DEFAULT_GENERATION_SETTINGS };

  if (genRaw && typeof genRaw === "object") {
    if (typeof genRaw.resolution === "string") {
      const norm = normaliseResolution(genRaw.resolution);
      if (isValidResolution(norm)) {
        settings.resolution = norm;
      } else {
        console.warn(`Grip Shot: invalid resolution "${genRaw.resolution}", using default "${settings.resolution}". Allowed: ${ALLOWED_RESOLUTIONS.join(", ")}`);
      }
    }
    if (typeof genRaw.aspectRatio === "string") {
      const ar = genRaw.aspectRatio.trim();
      if (isValidAspectRatio(ar)) {
        settings.aspectRatio = ar;
      } else {
        console.warn(`Grip Shot: invalid aspectRatio "${genRaw.aspectRatio}", using default "${settings.aspectRatio}". Allowed: ${ALLOWED_ASPECT_RATIOS.join(", ")}`);
      }
    }
  }

  const input = Object.keys(promptFields).length > 0 ? promptFields : null;
  return { input, generationSettings: settings };
}
