export const PROVIDER_CONNECTION_LIMIT_SECONDS = 10 * 60;
export const SESSION_WARNING_LEAD_SECONDS = 2 * 60;

export interface SessionPolicy {
  maxSessionSeconds: number;
  warningAtSeconds: number;
  reason: "provider_limit" | "usage_limit";
}

export function computeSessionPolicy(input: {
  remainingUsageSeconds: number;
  providerConnectionLimitSeconds?: number;
  warningLeadSeconds?: number;
}): SessionPolicy {
  const remaining = Math.max(
    0,
    Math.floor(
      Number.isFinite(input.remainingUsageSeconds)
        ? input.remainingUsageSeconds
        : 0,
    ),
  );
  const providerLimit = Math.max(
    0,
    Math.floor(
      Number.isFinite(input.providerConnectionLimitSeconds)
        ? input.providerConnectionLimitSeconds!
        : PROVIDER_CONNECTION_LIMIT_SECONDS,
    ),
  );
  const warningLead = Math.max(
    0,
    Math.floor(
      Number.isFinite(input.warningLeadSeconds)
        ? input.warningLeadSeconds!
        : SESSION_WARNING_LEAD_SECONDS,
    ),
  );

  const useUsageLimit = remaining < providerLimit;
  const maxSessionSeconds = useUsageLimit ? remaining : providerLimit;

  return {
    maxSessionSeconds,
    warningAtSeconds: Math.max(0, maxSessionSeconds - warningLead),
    reason: useUsageLimit ? "usage_limit" : "provider_limit",
  };
}
