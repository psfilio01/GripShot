import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getHumanModel, softDeleteHumanModelDoc } from "@/lib/db/human-models";
import type { HumanModelDoc } from "@/lib/db/types";
import { z } from "zod";

const BodySchema = z.object({
  ids: z
    .array(z.string().min(1).max(128))
    .min(1, "Select at least one model")
    .max(50, "Too many models at once (max 50)"),
});

function isTrashed(data: HumanModelDoc): boolean {
  return data.deletedAt != null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = [...new Set(body.ids)];
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Too many unique models (max 50)" },
      { status: 400 },
    );
  }

  const workspaceId = session.user.workspaceId;
  const uid = session.user.uid;
  let trashed = 0;
  let skipped = 0;
  let notFound = 0;

  for (const modelId of ids) {
    const model = await getHumanModel(workspaceId, modelId);
    if (!model) {
      notFound++;
      continue;
    }
    if (isTrashed(model)) {
      skipped++;
      continue;
    }
    try {
      await softDeleteHumanModelDoc(workspaceId, modelId, uid);
      trashed++;
    } catch (e) {
      console.error("Batch human model delete failed:", modelId, e);
      return NextResponse.json(
        { error: "One or more deletes failed", trashed, skipped, notFound },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ trashed, skipped, notFound });
}
