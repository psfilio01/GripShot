import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listGenerations } from "@/lib/db/generations";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as
    | "listing-copy"
    | "aplus"
    | null;
  const limit = Math.min(
    50,
    parseInt(searchParams.get("limit") ?? "20", 10) || 20,
  );

  const generations = await listGenerations(
    session.user.workspaceId,
    type ?? undefined,
    limit,
  );

  return NextResponse.json({ generations });
}
