import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { checkQuota } from "@/lib/billing/quota";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const quota = await checkQuota(session.user.workspaceId);

  return NextResponse.json({
    plan: session.workspace.plan,
    ...quota,
  });
}
