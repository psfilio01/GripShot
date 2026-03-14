import { startImageJob, getJob } from "./packages/workflow-core/src";

async function main() {
  const job = await startImageJob({
    productId: "pilates-mini-ball",
    workflowType: "NEUTRAL_PRODUCT_SHOT"
  });
  console.log("Job:", job);

  const full = await getJob(job.jobId);
  console.log("Full job:", full);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});