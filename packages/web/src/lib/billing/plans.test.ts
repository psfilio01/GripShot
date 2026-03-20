import { describe, it, expect } from "vitest";
import { PLANS, getPlanById } from "./plans";

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
