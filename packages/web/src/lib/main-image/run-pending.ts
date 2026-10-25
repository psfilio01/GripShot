import { consumeCredit } from "@/lib/billing/quota";
import {
  deletePendingImageGeneration,
  failPendingImageGeneration,
  isPendingImageGenerationCancelled,
} from "@/lib/db/pending-image-generations";
import {
  registerGenerationCancellation,
  releaseGenerationCancellation,
} from "@/lib/generation/cancellation-registry";
import type { executeMainImageLock } from "@fashionmentum/workflow-core";

type MainSource = Parameters<typeof executeMainImageLock>[0];
type MainTargetColors = Parameters<typeof executeMainImageLock>[1];

interface RunPendingMainImageInput {
  workspaceId: string;
  isAdmin: boolean;
  requestId: string;
  source: MainSource;
  targetColors: MainTargetColors;
}

export async function runPendingMainImage(
  input: RunPendingMainImageInput,
): Promise<void> {
  const signal = registerGenerationCancellation(
    input.workspaceId,
    input.requestId,
  );
  const isCancelled = () =>
    isPendingImageGenerationCancelled(input.workspaceId, input.requestId);

  try {
    if (await isCancelled()) return;
    const { executeMainImageLock } = await import(
      "@fashionmentum/workflow-core"
    );
    const result = await executeMainImageLock(input.source, input.targetColors, {
      signal,
      isCancelled,
    });
    const successCount = result.generatedVariants.filter(
      (variant) => variant.status === "completed",
    ).length;

    if (!input.isAdmin && successCount > 0) {
      await consumeCredit(input.workspaceId, successCount);
    }
    if (result.cancelled || (await isCancelled())) return;
    if (successCount === 0) {
      throw new Error("No Amazon Main image could be generated.");
    }
    await deletePendingImageGeneration(input.workspaceId, input.requestId).catch(
      () => {},
    );
  } catch (error) {
    if (await isCancelled().catch(() => false)) return;
    await failPendingImageGeneration(
      input.workspaceId,
      input.requestId,
      error instanceof Error ? error.message : String(error),
    ).catch(() => {});
  } finally {
    releaseGenerationCancellation(input.workspaceId, input.requestId);
    if (input.source.temporarySource) {
      const { deleteTemporaryImageSource } = await import(
        "@fashionmentum/workflow-core"
      );
      await deleteTemporaryImageSource(input.source.id).catch(() => {});
    }
  }
}
