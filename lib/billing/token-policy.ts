import { computeSessionPolicy } from "../live/session-policy.ts";

export interface TutorTokenPolicy {
  allowed: boolean;
  maxSessionSeconds: number;
  warningAtSeconds: number;
  reason: "provider_limit" | "usage_limit";
}

export function buildTutorTokenPolicy(input: {
  remainingSeconds: number;
}): TutorTokenPolicy {
  const session = computeSessionPolicy({
    remainingUsageSeconds: input.remainingSeconds,
  });

  return {
    allowed: session.maxSessionSeconds > 0,
    maxSessionSeconds: session.maxSessionSeconds,
    warningAtSeconds: session.warningAtSeconds,
    reason: session.reason,
  };
}
