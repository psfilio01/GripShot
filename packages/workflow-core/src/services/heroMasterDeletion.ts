import { metadataStore } from "./metadataStore";
import { deleteStoredImage } from "./resultStorage";

export interface DeleteHeroMasterResult {
  deletedImageIds: string[];
}

export async function deleteTemporaryImageSource(imageId: string): Promise<void> {
  const source = await metadataStore.getVariantById(imageId);
  if (!source?.temporarySource) return;
  await deleteStoredImage(source.filePath);
  await metadataStore.deleteVariantsByIds([source.id]);
}

/** Permanently delete a Hero/Main master and every color variant derived from it. */
export async function deleteHeroMaster(
  imageId: string,
): Promise<DeleteHeroMasterResult | null> {
  const master = await metadataStore.getVariantById(imageId);
  if (
    !master ||
    (master.status !== "hero_lock" && master.status !== "main_image")
  ) {
    return null;
  }

  const jobs = await metadataStore.listJobs();
  const variants = (
    await Promise.all(jobs.map((job) => metadataStore.listVariantsForJob(job.id)))
  ).flat();
  const toDelete = variants.filter(
    (variant) =>
      variant.id === imageId || variant.colorLineage?.parentVariantId === imageId,
  );

  await Promise.all(toDelete.map((variant) => deleteStoredImage(variant.filePath)));
  const deletedImageIds = toDelete.map((variant) => variant.id);
  await metadataStore.deleteVariantsByIds(deletedImageIds);
  return { deletedImageIds };
}
