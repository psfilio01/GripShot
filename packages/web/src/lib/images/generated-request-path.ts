/** Safe segment for job id / bucket / file name (no traversal). */
export const GENERATED_SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export const GENERATED_BUCKETS = [
  "neutral",
  "favorites",
  "rejected",
  "variants",
] as const;

export type GeneratedBucket = (typeof GENERATED_BUCKETS)[number];

export function isGeneratedBucket(b: string): b is GeneratedBucket {
  return (GENERATED_BUCKETS as readonly string[]).includes(b);
}

/**
 * Parse `generated/<product segments…>/<jobId>/<bucket>/<file>` from URL path segments.
 */
export function parseGeneratedTrailing(
  segments: string[],
): { jobId: string; bucket: string; fileName: string } | null {
  if (segments[0] !== "generated" || segments.length < 5) return null;
  const fileName = segments[segments.length - 1]!;
  const bucket = segments[segments.length - 2]!;
  const jobId = segments[segments.length - 3]!;
  if (
    !GENERATED_SAFE_SEGMENT.test(jobId) ||
    !isGeneratedBucket(bucket) ||
    !GENERATED_SAFE_SEGMENT.test(fileName)
  ) {
    return null;
  }
  return { jobId, bucket, fileName };
}
