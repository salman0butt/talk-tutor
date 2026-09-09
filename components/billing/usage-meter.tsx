import Link from "next/link";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";

function exactDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}

function periodDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function UsageMeter({
  entitlement,
  compact = false,
}: {
  entitlement: EntitlementSnapshot;
  compact?: boolean;
}) {
  const percentage =
    entitlement.allowanceSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (entitlement.usedSeconds / entitlement.allowanceSeconds) * 100,
          ),
        )
      : 100;

  const warningCopy =
    entitlement.warningLevel === "exhausted"
      ? "Conversation allowance used. Upgrade or wait for the next period."
      : entitlement.warningLevel === "critical"
        ? "Less than 10% of your conversation allowance remains."
        : entitlement.warningLevel === "warning"
          ? "You have used more than 80% of this period's allowance."
          : null;

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
          : "rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7"
      }
      aria-label="Conversation usage"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
            {entitlement.planName} conversation usage
          </p>
          <p className={compact ? "mt-2 text-xl font-semibold" : "mt-2 text-2xl font-semibold"}>
            {exactDuration(entitlement.usedSeconds)} used
          </p>
        </div>
        <Link
          href="/billing"
          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
        >
          Billing
        </Link>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-label="Conversation allowance used"
        aria-valuemin={0}
        aria-valuemax={entitlement.allowanceSeconds}
        aria-valuenow={Math.min(
          entitlement.usedSeconds,
          entitlement.allowanceSeconds,
        )}
      >
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-white/35">
        <span>{exactDuration(entitlement.remainingSeconds)} remaining</span>
        <span>
          {Math.floor(entitlement.allowanceSeconds / 60)} min included
        </span>
      </div>

      {!compact && (
        <p className="mt-4 text-xs leading-5 text-white/30">
          Period: {periodDate(entitlement.periodStart)} –{" "}
          {periodDate(entitlement.periodEnd)} UTC. Enforcement uses exact
          seconds; the display above shows minutes and seconds without rounding
          your allowance.
        </p>
      )}

      {warningCopy && (
        <p
          className={
            entitlement.warningLevel === "exhausted"
              ? "mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
              : "mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100"
          }
        >
          {warningCopy}
        </p>
      )}
    </section>
  );
}
