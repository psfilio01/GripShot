import { formatGoogleGenerativeLanguageApiError } from "@fashionmentum/workflow-core";

/**
 * Normalizes errors from Gemini (axios in workflow-core, fetch in web) for
 * API responses, Firestore generation logs, and logging.
 */
export function formatGenerationError(err: unknown): string {
  if (err == null) return "Unknown error";

  const duck = err as {
    response?: { status?: number; data?: unknown };
  };
  if (duck.response != null) {
    const msg = formatGoogleGenerativeLanguageApiError(
      duck.response.status,
      duck.response.data,
    );
    if (msg) return msg;
  }

  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
