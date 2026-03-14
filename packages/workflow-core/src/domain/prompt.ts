import type { WorkflowType } from "../types/api";

export interface PromptTemplate {
  id: string;
  name: string;
  version: number;
  workflowType: WorkflowType;
  /**
   * Free-form template definition; could be text with tokens or a JSON structure.
   */
  definition: unknown;
}

export interface BuiltPrompt {
  id: string;
  templateId: string;
  templateVersion: number;
  workflowType: WorkflowType;
  /**
   * Text prompt sent to the model (if applicable).
   */
  text?: string;
  /**
   * JSON payload for providers that prefer structured prompts.
   */
  jsonPayload?: unknown;
}

