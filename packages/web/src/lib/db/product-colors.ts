import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { z } from "zod";

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export const ProductColorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  hex: z.string().regex(HEX_REGEX, "Must be a valid 6-digit hex color (e.g. #FF5733)"),
  notes: z.string().max(500).default(""),
  sku: z.string().max(100).default(""),
});

export const CreateColorSchema = ProductColorSchema.omit({ id: true });

export type ProductColor = z.infer<typeof ProductColorSchema>;
export type CreateColorInput = z.infer<typeof CreateColorSchema>;

function colorsRef(workspaceId: string, productId: string) {
  return getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("products")
    .doc(productId);
}

export async function listProductColors(
  workspaceId: string,
  productId: string,
): Promise<ProductColor[]> {
  const snap = await colorsRef(workspaceId, productId).get();
  if (!snap.exists) return [];
  const data = snap.data();
  return (data?.colors ?? []) as ProductColor[];
}

export async function addProductColor(
  workspaceId: string,
  productId: string,
  color: CreateColorInput,
): Promise<ProductColor> {
  const id = `color-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newColor: ProductColor = { id, ...color };

  await colorsRef(workspaceId, productId).update({
    colors: FieldValue.arrayUnion(newColor),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return newColor;
}

export async function updateProductColor(
  workspaceId: string,
  productId: string,
  colorId: string,
  updates: Partial<CreateColorInput>,
): Promise<ProductColor | null> {
  const ref = colorsRef(workspaceId, productId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const colors: ProductColor[] = snap.data()?.colors ?? [];
  const idx = colors.findIndex((c) => c.id === colorId);
  if (idx === -1) return null;

  const updated = { ...colors[idx], ...updates };
  if (updates.hex) {
    const parsed = HEX_REGEX.test(updates.hex);
    if (!parsed) return null;
  }

  colors[idx] = updated;
  await ref.update({
    colors,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return updated;
}

export async function deleteProductColor(
  workspaceId: string,
  productId: string,
  colorId: string,
): Promise<boolean> {
  const ref = colorsRef(workspaceId, productId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const colors: ProductColor[] = snap.data()?.colors ?? [];
  const filtered = colors.filter((c) => c.id !== colorId);
  if (filtered.length === colors.length) return false;

  await ref.update({
    colors: filtered,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return true;
}
