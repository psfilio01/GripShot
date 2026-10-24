import { z } from "zod";

export const GENERATION_ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;

export const GENERATION_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

export type GenerationAspectRatio = (typeof GENERATION_ASPECT_RATIOS)[number];
export type GenerationResolution = (typeof GENERATION_RESOLUTIONS)[number];

export const zGenerationAspectRatio = z.enum(GENERATION_ASPECT_RATIOS);
export const zGenerationResolution = z.enum(GENERATION_RESOLUTIONS);
