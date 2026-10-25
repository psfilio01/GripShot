import { metadataStore } from "./metadataStore";
import { deleteStoredImage } from "./resultStorage";

export interface DeleteHeroMasterResult {
  deletedImageIds: string[];
}

/** Permanently delete a Hero master and every color variant derived from it. */
export async function deleteHeroMaster(
  imageId: string,
): Promise<DeleteHeroMasterResult | null> {
  const master = await metadataStore.getVariantById(imageId);
  if (!master || master.status !== "hero_lock") return null;

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
