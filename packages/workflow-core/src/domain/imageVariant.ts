export type ImageVariantStatus =
  | "neutral"
  | "favorite"
  | "rejected"
  | "variant"
  | "hero_lock";

export interface ColorLineage {
  parentVariantId: string;
  targetColorName: string;
  targetColorHex: string;
  generationMethod: "hero_lock_recolor";
}

export interface ImageVariant {
  id: string;
  jobId: string;
  productId: string;
  status: ImageVariantStatus;
  filePath: string;
  colorVariant?: string | null;
  createdAt: string;
  /** Set when this variant is the hero-locked master for color expansion. */
  heroLockId?: string;
  /** Set on derived color variants to trace lineage back to the master. */
  colorLineage?: ColorLineage;
}
