import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getWorkflow, getWorkflowSteps, updateWorkflowStep } from "@/lib/db/workflows";
import { resolve, isAbsolute } from "path";
import { existsSync } from "fs";
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
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, index: indexStr } = await params;
  const stepIndex = parseInt(indexStr, 10);
  if (Number.isNaN(stepIndex) || stepIndex < 0) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

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
    const step = steps.find((s) => s.index === stepIndex);
    if (!step) {
      return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 404 });
    }

    if (step.status !== "completed" || !step.resultImagePath) {
      return NextResponse.json(
        { error: "Step must be completed with an image" },
        { status: 400 },
      );
    }

    if (step.upscaledImagePath) {
      return NextResponse.json({
        upscaledImagePath: step.upscaledImagePath,
        alreadyUpscaled: true,
      });
    }

    const imagePath = step.resultImagePath;
    const outputKey = upscaledPath(imagePath);
    const dataRoot = getWorkflowDataRoot();

    if (usesGcsBlobStorage() && !isAbsolute(imagePath)) {
      const buffer = await readWorkflowDataFile(imagePath);
      const tmpIn = resolve(dataRoot, "__upscale_tmp_in.png");
      const tmpOut = resolve(dataRoot, "__upscale_tmp_out.png");
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

    await updateWorkflowStep(session.user.workspaceId, id, stepIndex, {
      upscaledImagePath: outputKey,
    });

    return NextResponse.json({ upscaledImagePath: outputKey });
  } catch (err) {
    console.error("Upscale failed:", err);
    return NextResponse.json({ error: "Upscale failed" }, { status: 500 });
  }
}
