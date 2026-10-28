import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { listAndPrunePendingImageGenerations } from "@/lib/db/pending-image-generations";
import { listProducts } from "@/lib/db/products";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const productIdFilter = req.nextUrl.searchParams.get("productId");

  try {
    const { metadataStore } = await import("@fashionmentum/workflow-core");

    const allowedProductIds = new Set((await listProducts(session.user.workspaceId)).map((product) => product.id));
    let jobs = (await metadataStore.listJobs()).filter((job) => allowedProductIds.has(job.productId));
    if (productIdFilter) {
      jobs = jobs.filter((j) => j.productId === productIdFilter);
    }

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
          heroLockId: v.heroLockId,
          colorLineage: v.colorLineage,
          qualityScore: v.qualityScore,
          mainImage: v.mainImage,
        })),
      });
    }

    let pendingImageGenerations = await listAndPrunePendingImageGenerations(
      session.user.workspaceId,
    );
    if (productIdFilter) {
      pendingImageGenerations = pendingImageGenerations.filter(
        (p) => p.productId === productIdFilter,
      );
    }

    return NextResponse.json({ jobs: results, pendingImageGenerations });
  } catch (err) {
    console.error("Failed to list jobs:", err);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}
