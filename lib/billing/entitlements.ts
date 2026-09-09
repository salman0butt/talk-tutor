import { getPlanDefinition, isPaidPlanId, planAllowanceSeconds, type PlanId } from "./plans.ts";
import { getFreeBillingPeriod, normalizeBillingPeriod, type BillingPeriod } from "./periods.ts";
import { calculateUsedSeconds, usageWarningLevel, type UsageInterval, type UsageWarningLevel } from "./usage.ts";

export interface BillingAccountSnapshot {
  planId?: unknown;
  status?: unknown;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}

export interface EntitlementSnapshot {
  planId: PlanId;
  planName: string;
  status: string;
  allowanceSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  isPaid: boolean;
  canStartTutor: boolean;
  warningLevel: UsageWarningLevel;
}

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

function resolvePaidPeriod(
  now: Date,
  account: BillingAccountSnapshot | null | undefined,
): { planId: PlanId; period: BillingPeriod; status: string; cancelAtPeriodEnd: boolean } | null {
  if (!account || !isPaidPlanId(account.planId) || typeof account.status !== "string") {
    return null;
  }
  if (!PAID_STATUSES.has(account.status)) return null;

  const period = normalizeBillingPeriod(account.currentPeriodStart, account.currentPeriodEnd);
  if (!period) return null;

  const nowMs = now.getTime();
  if (
    !Number.isFinite(nowMs) ||
    nowMs < Date.parse(period.start) ||
    nowMs >= Date.parse(period.end)
  ) {
    return null;
  }

  return {
    planId: account.planId,
    period,
    status: account.status,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd === true,
  };
}

export function resolveEntitlement(input: {
  now: Date;
  billingAccount?: BillingAccountSnapshot | null;
  usageEvents: UsageInterval[];
}): EntitlementSnapshot {
  const paid = resolvePaidPeriod(input.now, input.billingAccount);
  const planId: PlanId = paid?.planId ?? "free";
  const plan = getPlanDefinition(planId)!;
  const period = paid?.period ?? getFreeBillingPeriod(input.now);
  const allowanceSeconds = planAllowanceSeconds(planId);
  const usedSeconds = Math.min(
    Number.MAX_SAFE_INTEGER,
    calculateUsedSeconds(input.usageEvents, period),
  );
  const remainingSeconds = Math.max(0, allowanceSeconds - usedSeconds);

  return {
    planId,
    planName: plan.name,
    status: paid?.status ?? "free",
    allowanceSeconds,
    usedSeconds,
    remainingSeconds,
    periodStart: period.start,
    periodEnd: period.end,
    cancelAtPeriodEnd: paid?.cancelAtPeriodEnd ?? false,
    isPaid: planId !== "free",
    canStartTutor: remainingSeconds > 0,
    warningLevel: usageWarningLevel(usedSeconds, allowanceSeconds),
  };
}
