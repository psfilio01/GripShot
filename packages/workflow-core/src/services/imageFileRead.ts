import path from "node:path";
import { readWorkflowDataFile } from "./objectStorage";

/** Extension without dot, lowercase. */
export async function readImageFileForProcessing(
  imagePath: string,
): Promise<{ buffer: Buffer; ext: string }> {
  const buffer = await readWorkflowDataFile(imagePath);
  const base =
    path.isAbsolute(imagePath) || imagePath.includes("/") || imagePath.includes("\\")
      ? path.basename(imagePath)
      : imagePath.split("/").pop() ?? imagePath;
  const ext = path.extname(base).replace(/^\./, "").toLowerCase() || "jpg";
  return { buffer, ext };
}
