export const IMAGE_CATEGORIES = [
  { id: "primary", label: "Primary", description: "Main product photos" },
  { id: "logo", label: "Logo", description: "Logo close-ups" },
  { id: "packaging", label: "Packaging", description: "Packaging shots" },
  { id: "angle", label: "Angle", description: "Specific angle views" },
  { id: "detail", label: "Detail", description: "Texture / detail close-ups" },
  { id: "other", label: "Other", description: "Uncategorized" },
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]["id"];

export const DEFAULT_CATEGORY: ImageCategory = "primary";

export function isValidCategory(v: string): v is ImageCategory {
  return IMAGE_CATEGORIES.some((c) => c.id === v);
}

export function getCategoryLabel(id: string): string {
  return IMAGE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
