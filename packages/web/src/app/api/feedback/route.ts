import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  createPendingImageGeneration,
  deletePendingImageGeneration,
  failPendingImageGeneration,
} from "@/lib/db/pending-image-generations";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const TargetColorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const FeedbackSchema = z.object({
  imageId: z.string().min(1),
  action: z.enum(["favorite", "reject", "hero_lock"]),
  targetColors: z.array(TargetColorSchema).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { imageId, action, targetColors } = FeedbackSchema.parse(body);

    if (action === "hero_lock" && (!targetColors || targetColors.length === 0)) {
      return NextResponse.json(
        { error: "Hero requires at least one target color." },
        { status: 400 },
      );
    }

    if (action === "hero_lock") {
      const { prepareHeroLockMaster, executeHeroLock } = await import(
        "@fashionmentum/workflow-core"
      );

      const colors = targetColors!;
      const updatedVariant = await prepareHeroLockMaster({
        imageId,
        action: "hero_lock",
        targetColors: colors,
      });

      if (!updatedVariant) {
        return NextResponse.json(
          { error: "Image not found or could not be set as Hero." },
          { status: 404 },
        );
      }

      const requestId = randomUUID();
      const workspaceId = session.user.workspaceId;

      await createPendingImageGeneration(workspaceId, requestId, {
        productId: updatedVariant.productId,
        workflowType: "HERO_LOCK_RECOLOR",
        kind: "hero",
        expectedVariantCount: colors.length,
      });

      const masterSnapshot = { ...updatedVariant };
      const colorsSnapshot = colors.map((c) => ({ ...c }));

      after(async () => {
        try {
          await executeHeroLock(masterSnapshot, colorsSnapshot);
          await deletePendingImageGeneration(workspaceId, requestId).catch(
            () => {},
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await failPendingImageGeneration(workspaceId, requestId, msg).catch(
            () => {},
          );
        }
      });

      const updatedImage = {
        imageId: updatedVariant.id,
        status: updatedVariant.status as "hero_lock",
        filePath: updatedVariant.filePath,
        colorVariant: updatedVariant.colorVariant ?? undefined,
        heroLockId: updatedVariant.heroLockId,
      };

      return NextResponse.json({
        result: {
          updatedImage,
          newJobIds: [] as string[],
          requestId,
        },
      });
    }

    const { handleFeedback } = await import("@fashionmentum/workflow-core");
    const result = await handleFeedback({ imageId, action, targetColors });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Feedback failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Feedback failed" },
      { status: 500 },
    );
  }
}
