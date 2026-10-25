import { consumeCredit } from "@/lib/billing/quota";
import {
  deletePendingImageGeneration,
  failPendingImageGeneration,
} from "@/lib/db/pending-image-generations";
import type { executeHeroLock } from "@fashionmentum/workflow-core";

type HeroMaster = Parameters<typeof executeHeroLock>[0];
type HeroTargetColors = Parameters<typeof executeHeroLock>[1];

interface RunPendingHeroLockInput {
  workspaceId: string;
  isAdmin: boolean;
  requestId: string;
  master: HeroMaster;
  targetColors: HeroTargetColors;
}

/** Run Hero Lock after the HTTP response and keep quota/pending state consistent. */
export async function runPendingHeroLock(
  input: RunPendingHeroLockInput,
): Promise<void> {
  try {
    const { executeHeroLock } = await import("@fashionmentum/workflow-core");
    const result = await executeHeroLock(input.master, input.targetColors);
    const successCount = result.generatedVariants.filter(
      (variant) => variant.status === "completed",
    ).length;

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
    const message = error instanceof Error ? error.message : String(error);
    await failPendingImageGeneration(
      input.workspaceId,
      input.requestId,
      message,
    ).catch(() => {});
  }
}
