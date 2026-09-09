import Link from "next/link";
import { ArrowUpRight, Clock3, MessageSquareText } from "lucide-react";
import type { LearningSessionSummary } from "@/lib/learning/types";
import { formatDuration, formatSessionDate } from "@/lib/learning/format";

function feedbackLabel(status: LearningSessionSummary["feedbackStatus"]) {
  if (status === "completed") return "Feedback ready";
  if (status === "failed") return "Feedback failed";
  if (status === "processing" || status === "pending") return "Feedback pending";
  return "Transcript saved";
}

export function SessionCard({
  session,
  timezone,
}: {
  session: LearningSessionSummary;
  timezone: string;
}) {
  return (
    <Link
      href={`/history/${session.id}`}
      className="group block rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-amber-300/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">
            {session.topic}
          </p>
          <p className="mt-1 text-xs text-white/35">
            {formatSessionDate(session.endedAt, timezone)}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-amber-300" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/55">
          {session.language}
        </span>
        <span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/55">
          {session.proficiencyLevel}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-white/35">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDuration(session.durationSeconds)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquareText className="h-3.5 w-3.5" />
          {feedbackLabel(session.feedbackStatus)}
        </span>
      </div>
    </Link>
  );
}
