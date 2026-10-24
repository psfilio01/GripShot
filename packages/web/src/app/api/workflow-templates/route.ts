import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listWorkflowTemplates } from "@/lib/db/workflow-templates";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const templates = await listWorkflowTemplates(session.user.workspaceId);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("List workflow templates failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
