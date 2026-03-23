import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { createHumanModel } from "@/lib/db/human-models";
import { generateImageFromPrompt } from "@/lib/generation/gemini-image";
import { insertGenerationLog, updateGenerationLog } from "@/lib/db/generation-logs";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { resolve, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const logger = createLogger("generate:human-model");

const GenerateSchema = z.object({
  displayName: z.string().min(1).max(120),
  freetext: z.string().min(1).max(2000),
  gender: z.string().max(50).optional(),
  ageRange: z.string().max(50).optional(),
  bodyBuild: z.string().max(50).optional(),
  ethnicity: z.string().max(100).optional(),
  hairColor: z.string().max(50).optional(),
  hairLength: z.string().max(50).optional(),
  skinTone: z.string().max(50).optional(),
  height: z.string().max(50).optional(),
});

function getDataRoot(): string {
  return process.env.WORKFLOW_DATA_ROOT ?? resolve(process.cwd(), "../../data");
}

function buildModelPrompt(data: z.infer<typeof GenerateSchema>): string {
  const parts: string[] = [];

  parts.push(
    "Generate a single high-quality, photorealistic full-body portrait photograph of a person. " +
    "The image should look like a professional model reference photo.",
  );

  if (data.freetext) {
    parts.push(`Description: ${data.freetext}`);
  }

  const attrs: string[] = [];
  if (data.gender) attrs.push(`Gender: ${data.gender}`);
  if (data.ageRange) attrs.push(`Approximate age: ${data.ageRange}`);
  if (data.bodyBuild) attrs.push(`Body build: ${data.bodyBuild}`);
  if (data.ethnicity) attrs.push(`Ethnicity: ${data.ethnicity}`);
  if (data.hairColor) attrs.push(`Hair color: ${data.hairColor}`);
  if (data.hairLength) attrs.push(`Hair length: ${data.hairLength}`);
  if (data.skinTone) attrs.push(`Skin tone: ${data.skinTone}`);
  if (data.height) attrs.push(`Height: ${data.height}`);

  if (attrs.length > 0) {
    parts.push("Physical attributes:\n" + attrs.join("\n"));
  }

  const freetextLower = data.freetext.toLowerCase();
  const mentionsClothing =
    /bikini|swimsuit|dress|outfit|wearing|clothes|shirt|pants|skirt|gown|suit|jacket|top|jeans|shorts/i.test(
      freetextLower,
    );
  const mentionsBackground =
    /beach|mountain|studio|forest|city|room|apartment|loft|outdoor|indoor|garden|pool|street|landscape/i.test(
      freetextLower,
    );

  if (!mentionsClothing) {
    parts.push(
      "The person should be wearing a simple, plain black bikini (two-piece). " +
      "No logos, patterns, or accessories.",
    );
  }

  if (!mentionsBackground) {
    parts.push(
      "The background should be a clean, neutral, solid light-gray studio backdrop. " +
      "Soft, even studio lighting. No props or distracting elements.",
    );
  }

  parts.push(
    "The person should be standing in a natural, relaxed pose facing the camera. " +
    "Full body visible from head to feet. " +
    "The face should be clearly visible and well-lit. " +
    "Photorealistic quality, professional model photography style.",
  );

  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = GenerateSchema.parse(body);

    const modelId = await createHumanModel({
      workspaceId: session.user.workspaceId,
      displayName: data.displayName,
      notes: `AI-generated model: ${data.freetext.slice(0, 200)}`,
      source: "ai",
      aiPrompt: data.freetext,
      gender: data.gender,
      ageRange: data.ageRange,
      bodyBuild: data.bodyBuild,
      ethnicity: data.ethnicity,
      hairColor: data.hairColor,
      hairLength: data.hairLength,
      skinTone: data.skinTone,
      height: data.height,
    });

    const prompt = buildModelPrompt(data);

    logger.info("Human model generation started", {
      userId: session.user.uid,
      displayName: data.displayName,
      modelId,
    });
    logger.debug("Full prompt", { prompt });

    const startTime = Date.now();
    const logId = await insertGenerationLog({
      type: "human-model",
      workspaceId: session.user.workspaceId,
      userId: session.user.uid,
      userEmail: session.user.email,
      prompt,
      input: {
        displayName: data.displayName,
        freetext: data.freetext,
        gender: data.gender,
        ageRange: data.ageRange,
        bodyBuild: data.bodyBuild,
        ethnicity: data.ethnicity,
      },
      model: process.env.NANOBANANA_MODEL ?? "unknown",
      aspectRatio: "4:5",
      status: "started",
    });

    const result = await generateImageFromPrompt(prompt, "4:5");
    const durationMs = Date.now() - startTime;

    await updateGenerationLog(logId, { status: "completed", durationMs });
    logger.info("Human model generation completed", { durationMs, logId, modelId });

    const dir = join(getDataRoot(), "models", modelId, "reference");
    await mkdir(dir, { recursive: true });
    const filename = `portrait.${result.extension}`;
    await writeFile(join(dir, filename), result.buffer);

    return NextResponse.json({
      modelId,
      imageUrl: `/api/images/models/${modelId}/reference/${filename}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    logger.error("Human model generation failed", {
      error: err instanceof Error ? err.message : String(err),
      userId: session.user.uid,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
