import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getBackground } from "@/lib/db/backgrounds";
import { resolve, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { config } from "dotenv";
import { usesGcsBlobStorage, putDataObject } from "@fashionmentum/workflow-core";
import { getSingleImageUpload, imageUploadFileName, ImageUploadError, readImageUploadFormData, validateImageUpload } from "@/lib/images/upload-validation";

config({ path: resolve(process.cwd(), "../../.env") });

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

type Params = { params: Promise<{ backgroundId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { backgroundId } = await params;
  const bg = await getBackground(session.user.workspaceId, backgroundId);
  if (!bg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await readImageUploadFormData(req);
    const file = getSingleImageUpload(formData, "file");
    const { buffer, imageType } = await validateImageUpload(file);
    const safeName = imageUploadFileName(file.name, imageType.extension);

    if (usesGcsBlobStorage()) {
      await putDataObject(
        `backgrounds/${backgroundId}/${safeName}`,
        buffer,
        imageType.contentType,
      );
    } else {
      const dir = join(getDataRoot(), "backgrounds", backgroundId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, safeName), buffer);
    }

    return NextResponse.json({
      url: `/api/images/backgrounds/${backgroundId}/${encodeURIComponent(safeName)}`,
      filename: safeName,
    });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Background upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
