import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      uid: session.user.uid,
      email: session.user.email,
      displayName: session.user.displayName,
      photoURL: session.user.photoURL,
    },
    workspace: {
      id: session.user.workspaceId,
      name: session.workspace.name,
      plan: session.workspace.plan,
      quotaUsed: session.workspace.quotaUsed,
      quotaLimit: session.workspace.quotaLimit,
    },
  });
}
