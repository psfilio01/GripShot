import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import archiver from "archiver";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const status = body.status as string | undefined;
    const productId = body.productId as string | undefined;

    const { metadataStore } = await import("@fashionmentum/workflow-core");
    let jobs = await metadataStore.listJobs();

    if (productId) {
      jobs = jobs.filter((j) => j.productId === productId);
    }

    const dataRoot = getDataRoot();
    const files: { path: string; name: string }[] = [];

    for (const job of jobs) {
      const variants = await metadataStore.listVariantsForJob(job.id);
      for (const v of variants) {
        if (status && v.status !== status) continue;

        const absPath = resolve(v.filePath);
        if (!absPath.startsWith(resolve(dataRoot)) || !existsSync(absPath))
          continue;

        const ext = v.filePath.split(".").pop() ?? "png";
        files.push({
          path: absPath,
          name: `${job.productId}-${v.id.slice(0, 8)}.${ext}`,
        });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images found matching your criteria" },
        { status: 404 },
      );
    }

    const archive = archiver("zip", { zlib: { level: 1 } });

    for (const f of files) {
      archive.file(f.path, { name: f.name });
    }

    const chunks: Uint8Array[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));

    const finalized = new Promise<void>((res, rej) => {
      archive.on("end", res);
      archive.on("error", rej);
    });

    archive.finalize();
    await finalized;

    const buffer = Buffer.concat(chunks);
    const label = status ?? "all";
    const filename = productId
      ? `grip-shot-${productId}-${label}.zip`
      : `grip-shot-${label}.zip`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Download ZIP failed:", err);
    return NextResponse.json(
      { error: "Failed to create ZIP" },
      { status: 500 },
    );
  }
}
