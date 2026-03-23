/**
 * Robust parsing of fetch() responses for dashboard forms.
 * Avoids losing server error text when the body is not valid JSON.
 */

const MAX_FALLBACK_BODY_LEN = 800;

/**
 * Reads the full body as text, then parses JSON when possible.
 */
export async function readFetchResponseBody(res: Response): Promise<{
  data: unknown;
  rawText: string;
}> {
  const rawText = await res.text();
  if (!rawText.trim()) {
    return { data: null, rawText: "" };
  }
  try {
    return { data: JSON.parse(rawText) as unknown, rawText };
  } catch {
    return { data: null, rawText };
  }
}

/**
 * Builds a user-visible message for a non-2xx API response.
 * Prefer Next.js JSON `{ error: string }`; otherwise show raw body (truncated).
 */
export function messageFromApiFailure(
  res: Response,
  data: unknown,
  rawText: string,
  defaultMessage = "Request failed",
): string {
  if (data && typeof data === "object" && data !== null) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e.trim();
  }
  const t = rawText.trim();
  if (t) {
    return t.length <= MAX_FALLBACK_BODY_LEN
      ? t
      : `${t.slice(0, MAX_FALLBACK_BODY_LEN)}…`;
  }
  return `${defaultMessage} (${res.status})`;
}
