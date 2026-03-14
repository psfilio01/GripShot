export interface BrandRules {
  id: string;
  brandName: string;
  /**
   * Arbitrary JSON payload with brand DNA, palettes, composition rules, etc.
   */
  data: unknown;
}

