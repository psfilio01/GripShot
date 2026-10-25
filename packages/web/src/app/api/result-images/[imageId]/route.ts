import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { cancelPendingHeroGenerationsForMaster } from "@/lib/db/pending-image-generations";
import { cancelRegisteredGeneration } from "@/lib/generation/cancellation-registry";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { imageId } = await params;
  if (!imageId?.trim() || imageId.includes("/")) {
    return NextResponse.json({ error: "Missing image id" }, { status: 400 });
  }

  try {
    const cancelledRequestIds = await cancelPendingHeroGenerationsForMaster(
      session.user.workspaceId,
      imageId,
    );
    for (const requestId of cancelledRequestIds) {
      cancelRegisteredGeneration(session.user.workspaceId, requestId);
    }

    const { deleteHeroMaster } = await import("@fashionmentum/workflow-core");
    const result = await deleteHeroMaster(imageId);
    if (!result) {
      return NextResponse.json({ error: "Hero image not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      deletedImageIds: result.deletedImageIds,
      cancelledRequestIds,
    });
  } catch (error) {
    console.error("Hero image deletion failed:", error);
    return NextResponse.json(
      { error: "Hero image could not be deleted" },
      { status: 500 },
    );
  }
}
