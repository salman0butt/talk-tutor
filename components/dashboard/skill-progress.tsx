import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { FluencyTrend } from "@/lib/learning/analytics";

export function SkillProgress({
  trend,
  vocabularyLearned,
  sessionsThisWeek,
}: {
  trend: FluencyTrend;
  vocabularyLearned: number;
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
        Skill progress
      </p>
      <h2 className="mt-2 text-xl font-semibold">Defensible signals only</h2>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Fluency coaching</p>
              <p className="mt-1 text-xs text-white/30">
                Based on transcript sentence construction, vocabulary, and continuity.
              </p>
            </div>
            {trend.current === null ? (
              <span className="text-xs text-white/25">No feedback yet</span>
            ) : (
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
                    {delta}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.035] p-4">
            <p className="text-sm font-medium">Vocabulary growth</p>
            <p className="mt-3 text-2xl font-semibold">{vocabularyLearned}</p>
            <p className="mt-1 text-xs text-white/30">unique normalized terms</p>
          </div>
          <div className="rounded-2xl bg-white/[0.035] p-4">
            <p className="text-sm font-medium">Consistency</p>
            <p className="mt-3 text-2xl font-semibold">{sessionsThisWeek}</p>
            <p className="mt-1 text-xs text-white/30">completed sessions this week</p>
          </div>
        </div>
      </div>
    </section>
  );
}
