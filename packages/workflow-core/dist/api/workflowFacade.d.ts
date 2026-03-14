import type { StartImageJobInput, StartImageJobResult, GetJobResult, FeedbackEvent, HandleFeedbackResult } from "../types/api";
export declare function startImageJob(input: StartImageJobInput): Promise<StartImageJobResult>;
export declare function getJob(jobId: string): Promise<GetJobResult>;
export declare function handleFeedback(event: FeedbackEvent): Promise<HandleFeedbackResult>;
//# sourceMappingURL=workflowFacade.d.ts.map