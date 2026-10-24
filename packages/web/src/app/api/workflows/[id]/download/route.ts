import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getWorkflow, getWorkflowSteps } from "@/lib/db/workflows";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve, isAbsolute } from "path";
import { config } from "dotenv";
import archiver from "archiver";
import {
  usesGcsBlobStorage,
  getDataObjectBuffer,
} from "@fashionmentum/workflow-core";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const workflow = await getWorkflow(session.user.workspaceId, id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    const steps = await getWorkflowSteps(session.user.workspaceId, id);
    const dataRoot = getDataRoot();

    const files: { buffer: Buffer; name: string }[] = [];
    const indexEntries: {
      stepIndex: number;
      title: string;
      type: string;
      status: string;
      file?: string;
      text?: string;
      colorVariantFiles?: string[];
    }[] = [];

    async function readImageBuffer(imagePath: string): Promise<Buffer | null> {
      if (usesGcsBlobStorage() && !isAbsolute(imagePath)) {
        return getDataObjectBuffer(imagePath).catch(() => null);
      }
      const absPath = resolve(imagePath);
      if (absPath.startsWith(resolve(dataRoot)) && existsSync(absPath)) {
        return readFile(absPath).catch(() => null);
      }
      return null;
    }

    for (const step of steps) {
      const entry: (typeof indexEntries)[number] = {
        stepIndex: step.index,
        title: step.title,
        type: step.type,
        status: step.status,
      };

      const safeName = step.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      const stepDir = `step-${String(step.index).padStart(2, "0")}-${safeName}`;

      if (step.status === "completed" && step.resultImagePath) {
        const buffer = await readImageBuffer(step.resultImagePath);
        if (buffer) {
          const ext = step.resultImagePath.split(".").pop() ?? "png";
          const filename = `${stepDir}/original.${ext}`;
          files.push({ buffer, name: filename });
          entry.file = filename;
        }

        const upscaledPath = (step as unknown as Record<string, unknown>).upscaledImagePath as string | undefined;
        if (upscaledPath) {
          const upBuf = await readImageBuffer(upscaledPath);
          if (upBuf) {
            const ext = upscaledPath.split(".").pop() ?? "png";
            const upFilename = `${stepDir}/original-4k.${ext}`;
            files.push({ buffer: upBuf, name: upFilename });
          }
        }
      }

      const colorVariants = (step as unknown as Record<string, unknown>).colorVariants as
        | { colorName: string; colorHex: string; imagePath: string; status: string }[]
        | undefined;
      if (colorVariants?.length) {
        const cvFiles: string[] = [];
        for (const cv of colorVariants) {
          if (cv.status !== "completed" || !cv.imagePath) continue;
          const cvBuffer = await readImageBuffer(cv.imagePath);
          if (cvBuffer) {
            const ext = cv.imagePath.split(".").pop() ?? "png";
            const colorSafe = cv.colorName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 40);
            const cvFilename = `${stepDir}/colors/${colorSafe}.${ext}`;
            files.push({ buffer: cvBuffer, name: cvFilename });
            cvFiles.push(cvFilename);
          }
        }
        if (cvFiles.length > 0) {
          entry.colorVariantFiles = cvFiles;
        }
      }

      if (step.status === "completed" && step.resultText) {
        entry.text = step.resultText;
      }

      indexEntries.push(entry);
    }

    const archive = archiver("zip", { zlib: { level: 1 } });

    for (const f of files) {
      archive.append(f.buffer, { name: f.name });
    }

    const indexJson = JSON.stringify(
      {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          globalSettings: workflow.globalSettings,
        },
        steps: indexEntries,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    archive.append(indexJson, { name: "index.json" });

    const chunks: Uint8Array[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));

    const finalized = new Promise<void>((res, rej) => {
      archive.on("end", res);
      archive.on("error", rej);
    });

    archive.finalize();
    await finalized;

    const buffer = Buffer.concat(chunks);
    const safeName = workflow.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    const filename = `workflow-${safeName}.zip`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Workflow bundle download failed:", err);
    return NextResponse.json(
      { error: "Failed to create bundle ZIP" },
      { status: 500 },
    );
  }
}
