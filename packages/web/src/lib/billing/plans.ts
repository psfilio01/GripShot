export interface PlanDefinition {
  id: "free" | "starter" | "pro";
  name: string;
  credits: number;
  price: string;
  features: string[];
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
  },
];

export function getPlanById(id: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}
