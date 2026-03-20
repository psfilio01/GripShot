import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { ProductDoc } from "./types";

export interface CreateProductInput {
  workspaceId: string;
  brandId: string;
  name: string;
  category: string;
  description: string;
}

export async function createProduct(input: CreateProductInput): Promise<string> {
  const db = getDb();
  const ref = db
    .collection("workspaces")
    .doc(input.workspaceId)
    .collection("products")
    .doc();

  const now = FieldValue.serverTimestamp();
  await ref.set({
    name: input.name,
    brandId: input.brandId,
    category: input.category,
    description: input.description,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function listProducts(
  workspaceId: string,
): Promise<(ProductDoc & { id: string })[]> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("products")
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }));
}

export async function getProduct(
  workspaceId: string,
  productId: string,
): Promise<(ProductDoc & { id: string }) | null> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("products")
    .doc(productId)
    .get();

  return snap.exists ? { id: snap.id, ...(snap.data() as ProductDoc) } : null;
}

export async function updateProduct(
  workspaceId: string,
  productId: string,
  data: Partial<Omit<ProductDoc, "createdAt" | "updatedAt">>,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("products")
    .doc(productId)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteProduct(
  workspaceId: string,
  productId: string,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("products")
    .doc(productId)
    .delete();
}
