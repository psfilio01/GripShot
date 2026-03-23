import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { getBackground } from "@/lib/db/backgrounds";
import { generateImageFromPrompt } from "@/lib/generation/gemini-image";
import { insertGenerationLog, updateGenerationLog } from "@/lib/db/generation-logs";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { resolve, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const log = createLogger("generate:background");

const Schema = z.object({
  backgroundId: z.string().min(1),
  description: z.string().min(1).max(2000),
  type: z.enum(["canvas", "freestyle"]),
});

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function buildBackgroundPrompt(type: string, description: string): string {
  if (type === "canvas") {
    return (
      "Generate a high-resolution background image for product photography. " +
      "This should be a studio photo backdrop or canvas. " +
      `Specification: ${description}\n\n` +
      "The image should be clean, seamless, and suitable as a background for fashion/product photography. " +
      "No people, products, or objects. Just the background texture, color, gradient, or pattern as described. " +
      "High quality, even lighting, professional studio backdrop look."
    );
  }

  const descLower = description.toLowerCase();
  const mentionsPeople =
    /person|people|model|man|woman|crowd|human|figure/i.test(descLower);

  return (
    "Generate a high-resolution background scene photograph for product photography. " +
    `Scene: ${description}\n\n` +
    (mentionsPeople
      ? ""
      : "IMPORTANT: The scene must NOT contain any people or human figures. ") +
    "The image should be a beautiful, well-lit scene suitable as a background for fashion/product photography. " +
    "High quality, professional photography style. " +
    "The composition should leave natural space for a product or model to be composited in front."
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = Schema.parse(body);

    const bg = await getBackground(session.user.workspaceId, data.backgroundId);
    if (!bg) {
      return NextResponse.json({ error: "Background not found" }, { status: 404 });
    }

    const prompt = buildBackgroundPrompt(data.type, data.description);

    log.info("Background generation started", {
      userId: session.user.uid,
      backgroundId: data.backgroundId,
      type: data.type,
    });
    log.debug("Full prompt", { prompt });

    const startTime = Date.now();
    const logId = await insertGenerationLog({
      type: "background",
      workspaceId: session.user.workspaceId,
      userId: session.user.uid,
      userEmail: session.user.email,
      prompt,
      input: { backgroundId: data.backgroundId, type: data.type, description: data.description },
      model: process.env.NANOBANANA_MODEL ?? "unknown",
      aspectRatio: "4:5",
      status: "started",
    });

    const result = await generateImageFromPrompt(prompt, "4:5");
    const durationMs = Date.now() - startTime;

    await updateGenerationLog(logId, { status: "completed", durationMs });
    log.info("Background generation completed", { durationMs, logId });

    const dir = join(getDataRoot(), "backgrounds", data.backgroundId);
    await mkdir(dir, { recursive: true });
    const filename = `preview.${result.extension}`;
    await writeFile(join(dir, filename), result.buffer);

    return NextResponse.json({
      url: `/api/images/backgrounds/${data.backgroundId}/${filename}`,
      filename,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    log.error("Background generation failed", {
      error: err instanceof Error ? err.message : String(err),
      userId: session.user.uid,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
