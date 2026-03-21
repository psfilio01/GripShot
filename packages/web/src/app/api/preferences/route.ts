import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getPreferences, updatePreferences } from "@/lib/db/preferences";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const prefs = await getPreferences(session.user.workspaceId);
  return NextResponse.json(prefs);
}

const UpdateSchema = z.object({
  defaultAspectRatio: z.string().optional(),
  defaultResolution: z.string().optional(),
  defaultWorkflowType: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const prefs = UpdateSchema.parse(body);
    await updatePreferences(session.user.workspaceId, prefs);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Preferences update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}
