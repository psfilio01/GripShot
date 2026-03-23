import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getGenerationLog } from "@/lib/db/generation-logs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  const session = await getServerSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { logId } = await params;
  const log = await getGenerationLog(logId);
  if (!log) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ log });
}
