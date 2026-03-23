import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { deletePendingImageGeneration } from "@/lib/db/pending-image-generations";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { requestId } = await params;
  if (!requestId?.trim()) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  try {
    await deletePendingImageGeneration(session.user.workspaceId, requestId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete pending generation:", err);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }
}
