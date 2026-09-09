import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { SkillTrendSummary } from "@/lib/learning/progress";

export function SkillProgress({
  trend,
  vocabularySaved,
  sessionsThisWeek,
}: {
  trend: SkillTrendSummary;
  vocabularySaved: number;
  sessionsThisWeek: number;
}) {
  const delta = trend.delta;
  const TrendIcon =
    delta === null || delta === 0
      ? ArrowRight
      : delta > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
        Skill improvement
      </p>
      <h2 className="mt-2 text-xl font-semibold">Text-derived coaching trend</h2>

      {trend.status === "insufficient" ? (
        <div className="mt-6 rounded-2xl bg-white/[0.035] p-5">
          <p className="text-sm font-medium">Complete 3 scored sessions to unlock trends.</p>
          <p className="mt-2 text-xs leading-5 text-white/35">
            {trend.scores.length} of 3 scored sessions available. No trend line
            is shown until the minimum sample exists.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Fluency coaching score</p>
              <p className="mt-1 text-xs text-white/30">
                Stable transcript rubric; not an exam or acoustic score.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{trend.current}</p>
              {delta !== null && (
                <p
                  className={
                    delta > 0
                      ? "mt-1 flex items-center justify-end gap-1 text-xs text-emerald-300"
                      : delta < 0
                        ? "mt-1 flex items-center justify-end gap-1 text-xs text-amber-300"
                        : "mt-1 flex items-center justify-end gap-1 text-xs text-white/30"
                  }
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  {delta > 0 ? "+" : ""}
                  {delta} since first scored session
                </p>
              )}
            </div>
          </div>
          <div
            className="mt-5 flex h-20 items-end gap-2"
            role="img"
            aria-label={`Fluency coaching scores over ${trend.scores.length} sessions: ${trend.scores.join(", ")}`}
          >
            {trend.scores.map((score, index) => (
              <div
                key={index}
                className="min-w-2 flex-1 rounded-t bg-amber-300/55"
                style={{ height: `${Math.max(8, score)}%` }}
                title={String(score)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.035] p-4">
          <p className="text-sm font-medium">Saved vocabulary</p>
          <p className="mt-3 text-2xl font-semibold">{vocabularySaved}</p>
          <p className="mt-1 text-xs text-white/30">deduplicated saved terms</p>
        </div>
        <div className="rounded-2xl bg-white/[0.035] p-4">
          <p className="text-sm font-medium">Consistency</p>
          <p className="mt-3 text-2xl font-semibold">{sessionsThisWeek}</p>
          <p className="mt-1 text-xs text-white/30">completed sessions this week</p>
        </div>
      </div>
    </section>
  );
}
