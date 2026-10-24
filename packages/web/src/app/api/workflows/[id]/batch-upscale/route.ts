import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getWorkflow, getWorkflowSteps, updateWorkflowStep } from "@/lib/db/workflows";
import { resolve, isAbsolute } from "path";
import {
  upscaleImage,
  upscaledPath,
  isUpscalerAvailable,
  checkUpscalerOnStartup,
  readWorkflowDataFile,
  putDataObject,
  usesGcsBlobStorage,
  getWorkflowDataRoot,
} from "@fashionmentum/workflow-core";

checkUpscalerOnStartup();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  if (!isUpscalerAvailable()) {
    return NextResponse.json(
      { error: "Upscaler not available on this server" },
      { status: 503 },
    );
  }

  try {
    const workflow = await getWorkflow(session.user.workspaceId, id);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const steps = await getWorkflowSteps(session.user.workspaceId, id);
    const eligible = steps.filter(
      (s) =>
        s.status === "completed" &&
        s.resultImagePath &&
        !s.resultImageDeletedAt &&
        !s.upscaledImagePath,
    );

    if (eligible.length === 0) {
      return NextResponse.json({ upscaled: 0, total: 0 });
    }

    const dataRoot = getWorkflowDataRoot();
    let upscaled = 0;

    for (const step of eligible) {
      try {
        const imagePath = step.resultImagePath!;
        const outputKey = upscaledPath(imagePath);

        if (usesGcsBlobStorage() && !isAbsolute(imagePath)) {
          const buffer = await readWorkflowDataFile(imagePath);
          const tmpIn = resolve(dataRoot, `__upscale_batch_in_${step.index}.png`);
          const tmpOut = resolve(dataRoot, `__upscale_batch_out_${step.index}.png`);
          const fs = await import("fs/promises");
          await fs.mkdir(dataRoot, { recursive: true });
          await fs.writeFile(tmpIn, buffer);

          try {
            await upscaleImage(tmpIn, tmpOut);
            const outBuffer = await fs.readFile(tmpOut);
            await putDataObject(outputKey, outBuffer, "image/png");
          } finally {
            await fs.unlink(tmpIn).catch(() => {});
            await fs.unlink(tmpOut).catch(() => {});
          }
        } else {
          const absIn = isAbsolute(imagePath) ? imagePath : resolve(dataRoot, imagePath);
          const absOut = isAbsolute(outputKey) ? outputKey : resolve(dataRoot, outputKey);
          await upscaleImage(absIn, absOut);
        }

        await updateWorkflowStep(session.user.workspaceId, id, step.index, {
          upscaledImagePath: outputKey,
        });
        upscaled++;
      } catch (err) {
        console.error(`Batch upscale failed for step ${step.index}:`, err);
      }
    }

    return NextResponse.json({ upscaled, total: eligible.length });
  } catch (err) {
    console.error("Batch upscale failed:", err);
    return NextResponse.json({ error: "Batch upscale failed" }, { status: 500 });
  }
}
