export const PAID_PLAN_IDS = ["starter", "pro"] as const;

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];
export type PlanId = "free" | PaidPlanId;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyMinutes: number;
  monthlyPriceCents: number;
  currency: "usd";
}

const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    monthlyMinutes: 30,
    monthlyPriceCents: 0,
    currency: "usd",
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyMinutes: 150,
    monthlyPriceCents: 900,
    currency: "usd",
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyMinutes: 400,
    monthlyPriceCents: 1900,
    currency: "usd",
  },
};

export function getPlanDefinition(value: unknown): PlanDefinition | null {
  if (value !== "free" && value !== "starter" && value !== "pro") return null;
  return PLAN_DEFINITIONS[value];
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return value === "starter" || value === "pro";
}

export function planAllowanceSeconds(planId: PlanId): number {
  return PLAN_DEFINITIONS[planId].monthlyMinutes * 60;
}

export function listPlanDefinitions(): PlanDefinition[] {
  return ["free", ...PAID_PLAN_IDS].map((id) => PLAN_DEFINITIONS[id]);
}
