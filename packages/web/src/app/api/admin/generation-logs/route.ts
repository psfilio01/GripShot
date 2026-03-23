import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listGenerationLogs, type GenerationLogType } from "@/lib/db/generation-logs";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const type = url.searchParams.get("type") as GenerationLogType | null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const startAfter = url.searchParams.get("cursor") ?? undefined;

  const logs = await listGenerationLogs({
    type: type ?? undefined,
    limit,
    startAfter,
  });

  return NextResponse.json({ logs });
}
