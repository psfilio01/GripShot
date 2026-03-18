import { startImageJob, getJob } from "./packages/workflow-core/src";

async function main() {
  // Use NEUTRAL_PRODUCT_SHOT or AMAZON_LIFESTYLE_SHOT
  const workflowType = (process.env.WORKFLOW_TYPE as "NEUTRAL_PRODUCT_SHOT" | "AMAZON_LIFESTYLE_SHOT") ?? "AMAZON_LIFESTYLE_SHOT";

  const job = await startImageJob({
    productId: "Pilates Block",
    workflowType,
    ...(workflowType === "AMAZON_LIFESTYLE_SHOT" && {
      useGoldenBackground: true, // set true if data/brand/aurelea/backgrounds/golden.jpg exists
      //modelId: "elenamoreau",
      // creativeFreedom: true,
    }),
  });
  console.log("Job:", job);

  const full = await getJob(job.jobId);
  console.log("Full job:", full);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});