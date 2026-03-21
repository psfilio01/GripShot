import { describe, it, expect } from "vitest";
import { PLANS, getPlanById, getPlanLimits, CREDIT_PACKS, getCreditPackById } from "./plans";

describe("PLANS", () => {
  it("defines three plans in order: free, starter, pro", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "starter", "pro"]);
  });

  it("each plan has a positive credit limit", () => {
    for (const plan of PLANS) {
      expect(plan.credits).toBeGreaterThan(0);
    }
  });

  it("plans have increasing credit limits", () => {
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].credits).toBeGreaterThan(PLANS[i - 1].credits);
    }
  });

  it("each plan has at least one feature", () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getPlanById", () => {
  it("returns the correct plan for a valid id", () => {
    const starter = getPlanById("starter");
    expect(starter).toBeDefined();
    expect(starter!.id).toBe("starter");
    expect(starter!.credits).toBe(500);
  });

  it("returns undefined for an unknown id", () => {
    expect(getPlanById("enterprise")).toBeUndefined();
  });

  it("returns the free plan with 50 credits", () => {
    const free = getPlanById("free");
    expect(free).toBeDefined();
    expect(free!.credits).toBe(50);
  });

  it("returns the pro plan with 2000 credits", () => {
    const pro = getPlanById("pro");
    expect(pro).toBeDefined();
    expect(pro!.credits).toBe(2000);
  });
});

describe("getPlanLimits", () => {
  it("free plan allows 1 brand and 3 products", () => {
    const limits = getPlanLimits("free");
    expect(limits.maxBrands).toBe(1);
    expect(limits.maxProducts).toBe(3);
    expect(limits.aplusEnabled).toBe(false);
  });

  it("starter plan allows 3 brands and 20 products with A+", () => {
    const limits = getPlanLimits("starter");
    expect(limits.maxBrands).toBe(3);
    expect(limits.maxProducts).toBe(20);
    expect(limits.aplusEnabled).toBe(true);
  });

  it("pro plan has unlimited brands and products", () => {
    const limits = getPlanLimits("pro");
    expect(limits.maxBrands).toBe(Infinity);
    expect(limits.maxProducts).toBe(Infinity);
    expect(limits.aplusEnabled).toBe(true);
  });

  it("unknown plan returns free defaults", () => {
    const limits = getPlanLimits("enterprise");
    expect(limits.maxBrands).toBe(1);
    expect(limits.maxProducts).toBe(3);
    expect(limits.aplusEnabled).toBe(false);
  });
});

describe("CREDIT_PACKS", () => {
  it("defines three credit packs", () => {
    expect(CREDIT_PACKS).toHaveLength(3);
  });

  it("packs have increasing credit amounts", () => {
    for (let i = 1; i < CREDIT_PACKS.length; i++) {
      expect(CREDIT_PACKS[i].credits).toBeGreaterThan(CREDIT_PACKS[i - 1].credits);
    }
  });

  it("each pack has a positive credit count and price", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeTruthy();
    }
  });
});

describe("getCreditPackById", () => {
  it("returns the correct pack", () => {
    const pack = getCreditPackById("credits-500");
    expect(pack).toBeDefined();
    expect(pack!.credits).toBe(500);
  });

  it("returns undefined for unknown pack", () => {
    expect(getCreditPackById("credits-9999")).toBeUndefined();
  });
});
