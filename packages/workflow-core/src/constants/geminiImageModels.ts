/**
 * Allowlisted Gemini image model IDs for user-selectable generation (API surface).
 * Marketing names (Nano Banana / Pro) are shown in the UI only.
 */
export const ALLOWED_GEMINI_IMAGE_MODEL_IDS = [
  "gemini-nano-banana-2.1",
  "gemini-3-pro-image",
] as const;

export type AllowedGeminiImageModelId =
  (typeof ALLOWED_GEMINI_IMAGE_MODEL_IDS)[number];

const LEGACY_GEMINI_IMAGE_MODEL_IDS: Record<
  string,
  AllowedGeminiImageModelId
> = {
  "gemini-3.1-flash-image-preview": "gemini-nano-banana-2.1",
  "gemini-3-pro-image-preview": "gemini-3-pro-image",
};

/**
 * Resolve retired preview IDs stored in existing workflows to their supported
 * replacements. New input is restricted to the current allowlist above.
 */
export function normalizeGeminiImageModel(
  id: string | undefined | null,
): AllowedGeminiImageModelId | undefined {
  const trimmed = String(id ?? "").trim();
  if (!trimmed) return undefined;

  const normalized = LEGACY_GEMINI_IMAGE_MODEL_IDS[trimmed] ?? trimmed;
  return (ALLOWED_GEMINI_IMAGE_MODEL_IDS as readonly string[]).includes(
    normalized,
  )
    ? (normalized as AllowedGeminiImageModelId)
    : undefined;
}

export function isAllowedGeminiImageModel(
  id: string | undefined | null,
): boolean {
  return normalizeGeminiImageModel(id) !== undefined;
}
