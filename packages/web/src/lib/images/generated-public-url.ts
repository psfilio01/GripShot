/**
 * Maps a workflow `filePath` (absolute, may use Windows backslashes) to the
 * authenticated `/api/images/...` URL.
 *
 * The route only allows roots: `generated`, `products`, `models`. Generated
 * outputs must therefore be requested as `/api/images/generated/<rest>`.
 */
export function filePathToGeneratedImageUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const marker = "/generated/";
  const idx = lower.indexOf(marker);
  if (idx === -1) {
    return filePath;
  }
  const relative = normalized.slice(idx + marker.length);
  const segments = relative.split("/").filter(Boolean);
  if (segments.length === 0) {
    return filePath;
  }
  const encoded = segments.map((s) => encodeURIComponent(s)).join("/");
  return `/api/images/generated/${encoded}`;
}
