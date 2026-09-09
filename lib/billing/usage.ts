import type { BillingPeriod } from "./periods.ts";

export interface UsageInterval {
  startedAt: string;
  endedAt: string;
}

function validTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function overlapSeconds(
  startedAt: string,
  endedAt: string,
  periodStart: string,
  periodEnd: string,
): number {
  const start = validTime(startedAt);
  const end = validTime(endedAt);
  const windowStart = validTime(periodStart);
  const windowEnd = validTime(periodEnd);

  if (
    start === null ||
    end === null ||
    windowStart === null ||
    windowEnd === null ||
    end <= start ||
    windowEnd <= windowStart
  ) {
    return 0;
  }

  const overlapStart = Math.max(start, windowStart);
  const overlapEnd = Math.min(end, windowEnd);
  if (overlapEnd <= overlapStart) return 0;

  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
}

export function calculateUsedSeconds(
  events: UsageInterval[],
  period: BillingPeriod,
): number {
  return events.reduce(
    (total, event) =>
      total + overlapSeconds(event.startedAt, event.endedAt, period.start, period.end),
    0,
  );
}

export type UsageWarningLevel = "warning" | "critical" | "exhausted" | null;

export function usageWarningLevel(
  usedSeconds: number,
  allowanceSeconds: number,
): UsageWarningLevel {
  if (!Number.isFinite(allowanceSeconds) || allowanceSeconds <= 0) {
    return "exhausted";
  }
  const safeUsed = Math.max(0, Number.isFinite(usedSeconds) ? usedSeconds : 0);
  const ratio = safeUsed / allowanceSeconds;
  if (ratio >= 1) return "exhausted";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.8) return "warning";
  return null;
}

export function displayMinutes(seconds: number): number {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return Math.ceil(safe / 60);
}
