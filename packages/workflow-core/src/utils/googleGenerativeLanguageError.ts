/**
 * Parses Google Generative Language API error bodies (generateContent, etc.).
 * Typical JSON: { "error": { "code": 503, "message": "...", "status": "UNAVAILABLE" } }
 */
function parseErrorPayload(body: unknown): {
  message: string;
  status: string;
  code?: number;
} {
  let obj: unknown = body;
  if (typeof body === "string") {
    try {
      obj = JSON.parse(body) as unknown;
    } catch {
      return { message: body.trim().slice(0, 2000), status: "" };
    }
  }
  if (typeof obj !== "object" || obj === null) {
    return { message: "", status: "" };
  }
  const e = (obj as { error?: { message?: string; status?: string; code?: number } })
    .error;
  if (!e) {
    const keys = Object.keys(obj as object);
    if (keys.length === 0) {
      return { message: "", status: "" };
    }
    return { message: JSON.stringify(obj).slice(0, 500), status: "" };
  }
  const statusStr =
    typeof e.status === "string"
      ? e.status
      : typeof e.code === "number"
        ? String(e.code)
        : "";
  return {
    message: (e.message ?? "").trim(),
    status: statusStr,
    code: typeof e.code === "number" ? e.code : undefined,
  };
}

/**
 * Single human-readable line for logs, admin UI, and API error responses.
 */
export function formatGoogleGenerativeLanguageApiError(
  httpStatus: number | undefined,
  responseBody: unknown,
): string {
  const { message, status } = parseErrorPayload(responseBody);
  const parts: string[] = [];

  if (httpStatus != null) {
    parts.push(status ? `HTTP ${httpStatus} (${status})` : `HTTP ${httpStatus}`);
  } else if (status) {
    parts.push(status);
  }

  if (message) {
    parts.push(message);
  }

  const line = parts.join(": ").trim();
  if (line) return line;

  if (typeof responseBody === "string" && responseBody.trim()) {
    return responseBody.trim().slice(0, 2000);
  }

  return "";
}
