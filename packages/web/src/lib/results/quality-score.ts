/**
 * Returns the visual variant for a quality score badge.
 * Thresholds: >7 = green, 4–7 = amber, <4 = red.
 */
export function qualityScoreVariant(
  score: number,
): "green" | "amber" | "red" {
  if (score > 7) return "green";
  if (score >= 4) return "amber";
  return "red";
}

export type QualityScoreVariant = ReturnType<typeof qualityScoreVariant>;
