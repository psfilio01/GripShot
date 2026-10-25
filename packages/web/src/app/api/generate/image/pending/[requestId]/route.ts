import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import {
  cancelPendingImageGeneration,
  deletePendingImageGeneration,
} from "@/lib/db/pending-image-generations";
import { cancelRegisteredGeneration } from "@/lib/generation/cancellation-registry";

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
    const result = await cancelPendingImageGeneration(
      session.user.workspaceId,
      requestId,
    );
    if (result === "cancelled" || result === "already_cancelled") {
      cancelRegisteredGeneration(session.user.workspaceId, requestId);
      return NextResponse.json({ ok: true, action: "cancelled" });
    }
    if (result === "not_found") {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    await deletePendingImageGeneration(session.user.workspaceId, requestId);
    return NextResponse.json({ ok: true, action: "dismissed" });
  } catch (err) {
    console.error("Failed to delete pending generation:", err);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }
}
