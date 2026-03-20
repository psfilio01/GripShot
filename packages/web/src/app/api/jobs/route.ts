import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { metadataStore } = await import("@fashionmentum/workflow-core");

    const jobs = await metadataStore.listJobs();
    const results = [];

    for (const job of jobs.slice(0, 50)) {
      const variants = await metadataStore.listVariantsForJob(job.id);
      results.push({
        jobId: job.id,
        productId: job.productId,
        workflowType: job.workflowType,
        status: job.status,
        createdAt: job.createdAt,
        images: variants.map((v) => ({
          imageId: v.id,
          status: v.status,
          filePath: v.filePath,
        })),
      });
    }

    return NextResponse.json({ jobs: results });
  } catch (err) {
    console.error("Failed to list jobs:", err);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}
