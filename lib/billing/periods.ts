export interface BillingPeriod {
  start: string;
  end: string;
}

export function getFreeBillingPeriod(now: Date): BillingPeriod {
  const time = now.getTime();
  if (!Number.isFinite(time)) {
    throw new Error("A valid date is required.");
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function normalizeBillingPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): BillingPeriod | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}
