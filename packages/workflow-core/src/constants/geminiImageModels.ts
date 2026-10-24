/**
 * Allowlisted Gemini image model IDs for user-selectable generation (API surface).
 * Marketing names (Nano Banana / Pro) are shown in the UI only.
 */
export const ALLOWED_GEMINI_IMAGE_MODEL_IDS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
] as const;

export type AllowedGeminiImageModelId =
  (typeof ALLOWED_GEMINI_IMAGE_MODEL_IDS)[number];

export function isAllowedGeminiImageModel(
  id: string | undefined | null,
): id is AllowedGeminiImageModelId {
  if (id == null || String(id).trim() === "") return false;
  return (ALLOWED_GEMINI_IMAGE_MODEL_IDS as readonly string[]).includes(
    String(id).trim(),
  );
}
