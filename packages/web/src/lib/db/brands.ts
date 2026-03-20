import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import type { BrandDoc } from "./types";

export interface CreateBrandInput {
  workspaceId: string;
  name: string;
  isPrivateLabel: boolean;
  dna: string;
  targetAudience: string;
  productCategory: string;
  tone: string;
}

export async function createBrand(input: CreateBrandInput): Promise<string> {
  const db = getDb();
  const ref = db
    .collection("workspaces")
    .doc(input.workspaceId)
    .collection("brands")
    .doc();

  const now = FieldValue.serverTimestamp();
  await ref.set({
    name: input.name,
    isPrivateLabel: input.isPrivateLabel,
    dna: input.dna,
    targetAudience: input.targetAudience,
    productCategory: input.productCategory,
    tone: input.tone,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function listBrands(workspaceId: string): Promise<(BrandDoc & { id: string })[]> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("brands")
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as BrandDoc) }));
}

export async function getBrand(
  workspaceId: string,
  brandId: string,
): Promise<(BrandDoc & { id: string }) | null> {
  const snap = await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("brands")
    .doc(brandId)
    .get();

  return snap.exists ? { id: snap.id, ...(snap.data() as BrandDoc) } : null;
}

export async function updateBrand(
  workspaceId: string,
  brandId: string,
  data: Partial<Omit<BrandDoc, "createdAt" | "updatedAt">>,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("brands")
    .doc(brandId)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteBrand(
  workspaceId: string,
  brandId: string,
): Promise<void> {
  await getDb()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("brands")
    .doc(brandId)
    .delete();
}
