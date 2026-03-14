export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface ImageJob {
  id: string;
  productId: string;
  workflowType: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

