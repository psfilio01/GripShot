import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

const TargetColorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const FeedbackSchema = z.object({
  imageId: z.string().min(1),
  action: z.enum(["favorite", "reject", "hero_lock"]),
  targetColors: z.array(TargetColorSchema).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { imageId, action, targetColors } = FeedbackSchema.parse(body);

    if (action === "hero_lock" && (!targetColors || targetColors.length === 0)) {
      return NextResponse.json(
        { error: "Hero Lock requires at least one target color." },
        { status: 400 },
      );
    }

    const { handleFeedback } = await import("@fashionmentum/workflow-core");

    const result = await handleFeedback({ imageId, action, targetColors });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    console.error("Feedback failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Feedback failed" },
      { status: 500 },
    );
  }
}
