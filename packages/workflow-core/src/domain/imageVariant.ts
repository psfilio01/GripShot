export type ImageVariantStatus = "neutral" | "favorite" | "rejected" | "variant";

export interface ImageVariant {
  id: string;
  jobId: string;
  productId: string;
  status: ImageVariantStatus;
  filePath: string;
  colorVariant?: string | null;
  createdAt: string;
}

