export interface PlanLimits {
  maxBrands: number;
  maxProducts: number;
  aplusEnabled: boolean;
}

export interface PlanDefinition {
  id: "free" | "starter" | "pro";
  name: string;
  credits: number;
  price: string;
  features: string[];
  limits: PlanLimits;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    credits: 50,
    price: "€0",
    features: [
      "50 generation credits / month",
      "1 brand",
      "3 products",
      "Listing copy generation",
      "Basic image generation",
    ],
    limits: { maxBrands: 1, maxProducts: 3, aplusEnabled: false },
  },
  {
    id: "starter",
    name: "Starter",
    credits: 500,
    price: "€29/mo",
    features: [
      "500 generation credits / month",
      "3 brands",
      "20 products",
      "All generation types",
      "Priority support",
    ],
    limits: { maxBrands: 3, maxProducts: 20, aplusEnabled: true },
  },
  {
    id: "pro",
    name: "Pro",
    credits: 2000,
    price: "€79/mo",
    features: [
      "2,000 generation credits / month",
      "Unlimited brands",
      "Unlimited products",
      "All generation types",
      "A+ content workflows",
      "Priority support",
    ],
    limits: { maxBrands: Infinity, maxProducts: Infinity, aplusEnabled: true },
  },
];

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-100", name: "100 Credits", credits: 100, price: "€9" },
  { id: "credits-500", name: "500 Credits", credits: 500, price: "€39" },
  { id: "credits-1500", name: "1,500 Credits", credits: 1500, price: "€99" },
];

export function getCreditPackById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function getPlanById(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}

const DEFAULT_LIMITS: PlanLimits = { maxBrands: 1, maxProducts: 3, aplusEnabled: false };

export function getPlanLimits(planId: string): PlanLimits {
  return getPlanById(planId)?.limits ?? DEFAULT_LIMITS;
}
