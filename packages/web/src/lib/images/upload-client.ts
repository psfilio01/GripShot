import { assertImageUploadSize } from "./upload-limits";

/** Keep multi-select UX while each HTTP request stays below Cloud Run's body limit. */
export async function uploadImagesSequentially(
  url: string,
  selection: FileList | File[],
  fields: Record<string, string> = {},
): Promise<void> {
  const files = Array.from(selection);
  // Check every size before uploading anything, so a known invalid batch has no partial writes.
  files.forEach(assertImageUploadSize);
  let uploaded = 0;
  for (const file of files) {
    try {
      const body = new FormData();
      body.append("files", file);
      for (const [key, value] of Object.entries(fields)) body.append(key, value);
      const response = await fetch(url, { method: "POST", body });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Upload failed");
      }
      uploaded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      throw new Error(`${message} (${uploaded}/${files.length} images uploaded.)`);
    }
  }
}
