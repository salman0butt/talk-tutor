import Link from "next/link";
import {
  BookOpenCheck,
  Clock3,
  Flame,
  MessageCircleMore,
  Mic2,
} from "lucide-react";
import { CommonMistakes } from "@/components/dashboard/common-mistakes";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentSessions } from "@/components/dashboard/recent-sessions";
import { SkillProgress } from "@/components/dashboard/skill-progress";
import { WeeklyPractice } from "@/components/dashboard/weekly-practice";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardViewModel } from "@/lib/learning/server";

export default async function DashboardPage() {
  const [user, view] = await Promise.all([
    getCurrentUser(),
    getDashboardViewModel(),
  ]);

  const name =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    "";
  const firstName = name.trim().split(/\s+/)[0] || "";
  const { profile, snapshot, streak, fluencyTrend, weeklyPractice, recentSessions } =
    view;

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-amber-400">
            {firstName ? "Welcome back, " + firstName : "Your learning dashboard"}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            Keep building real speaking momentum.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40 sm:text-base">
            Your progress is calculated from completed conversations,
            persisted transcripts, and structured coaching feedback.
          </p>
          {snapshot.recentLanguages.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {snapshot.recentLanguages.map((language) => (
                <span
                  key={language}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-white/40"
                >
                  {language}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/tutor"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <Mic2 className="h-4 w-4" />
          Practice now
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Practice time"
          value={snapshot.totalMinutes + " min"}
          detail="all completed sessions"
          icon={Clock3}
        />
        <MetricCard
          label="Completed sessions"
          value={snapshot.completedSessions}
          detail={snapshot.sessionsThisWeek + " this week"}
          icon={MessageCircleMore}
        />
        <MetricCard
          label="Current streak"
          value={streak + (streak === 1 ? " day" : " days")}
          detail="60+ sec practice day"
          icon={Flame}
        />
        <MetricCard
          label="Vocabulary"
          value={snapshot.vocabularyLearned}
          detail="unique terms from feedback"
          icon={BookOpenCheck}
        />
      </div>

      {snapshot.completedSessions === 0 && (
        <section className="mt-8 rounded-3xl border border-amber-300/15 bg-amber-300/[0.04] p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/65">
            Start your first learning trail
          </p>
          <h2 className="mt-3 text-xl font-semibold">
            Speak for at least a minute and finish the session.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Once a finalized user turn exists, Talk Tutor saves the structured
            transcript. Completing a meaningful 60-second session also counts
            toward your streak.
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <WeeklyPractice entries={weeklyPractice} />
        <SkillProgress
          trend={fluencyTrend}
          vocabularyLearned={snapshot.vocabularyLearned}
          sessionsThisWeek={snapshot.sessionsThisWeek}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <CommonMistakes mistakes={snapshot.commonMistakes} />
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
            Your practice plan
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {profile.dailyPracticeTargetMinutes} minutes a day
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/40">
            Goal: {profile.learningGoal.replaceAll("_", " ")} · Preferred
            practice language: {profile.preferredLanguage}
          </p>
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="text-xs text-white/30">
              Practice-day boundaries use {profile.timezone}. A streak day
              requires at least one completed session with a user turn and
              60 seconds of practice.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-10">
        <RecentSessions
          sessions={recentSessions}
          timezone={profile.timezone}
        />
      </div>
    </div>
  );
}
