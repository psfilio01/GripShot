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
import type { executeHeroLock, ProductRecolorPolicy } from "@fashionmentum/workflow-core";

type HeroMaster = Parameters<typeof executeHeroLock>[0];
type HeroTargetColors = Parameters<typeof executeHeroLock>[1];

interface RunPendingHeroLockInput {
  workspaceId: string;
  isAdmin: boolean;
  requestId: string;
  master: HeroMaster;
  targetColors: HeroTargetColors;
  recolorPolicy?: ProductRecolorPolicy;
  regeneratedFromVariantId?: string;
}

/** Run Hero Lock after the HTTP response and keep quota/pending state consistent. */
export async function runPendingHeroLock(
  input: RunPendingHeroLockInput,
): Promise<void> {
  const signal = registerGenerationCancellation(
    input.workspaceId,
    input.requestId,
  );
  const isCancelled = () =>
    isPendingImageGenerationCancelled(input.workspaceId, input.requestId);
  try {
    if (await isCancelled()) return;
    const { executeHeroLock } = await import("@fashionmentum/workflow-core");
    const result = await executeHeroLock(input.master, input.targetColors, {
      signal,
      isCancelled,
      recolorPolicy: input.recolorPolicy,
      regeneratedFromVariantId: input.regeneratedFromVariantId,
    });
    const successCount = result.generatedVariants.filter(
      (variant) => variant.status === "completed",
    ).length;

    if (result.cancelled || (await isCancelled())) {
      if (!input.isAdmin && successCount > 0) {
        await consumeCredit(input.workspaceId, successCount);
      }
      return;
    }

    if (result.generatedVariants.length > 0 && successCount === 0) {
      throw new Error("No color variant could be generated.");
    }

    if (!input.isAdmin && successCount > 0) {
      await consumeCredit(input.workspaceId, successCount);
    }

    await deletePendingImageGeneration(
      input.workspaceId,
      input.requestId,
    ).catch(() => {});
  } catch (error) {
    if (await isCancelled().catch(() => false)) return;
    const message = error instanceof Error ? error.message : String(error);
    await failPendingImageGeneration(
      input.workspaceId,
      input.requestId,
      message,
    ).catch(() => {});
  } finally {
    releaseGenerationCancellation(input.workspaceId, input.requestId);
  }
}
