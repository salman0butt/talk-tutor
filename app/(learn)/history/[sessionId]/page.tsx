import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MessagesSquare } from "lucide-react";
import { SessionFeedbackView } from "@/components/history/session-feedback";
import { SessionTranscript } from "@/components/history/session-transcript";
import { formatDuration, formatSessionDate } from "@/lib/learning/format";
import { getSessionReviewViewModel } from "@/lib/learning/server";

export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const review = await getSessionReviewViewModel(sessionId);
  if (!review) notFound();

  const { session, profile, messages, feedback } = review;

  return (
    <div>
      <Link
        href="/history"
        className="inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to history
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap gap-2 text-xs text-white/40">
            <span>{session.language}</span>
            <span>·</span>
            <span>{session.proficiencyLevel}</span>
            <span>·</span>
            <span>{session.assistantVoice}</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {session.topic}
          </h1>
          <p className="mt-3 text-sm text-white/35">
            {formatSessionDate(session.endedAt, profile.timezone)}
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/25">
              <Clock3 className="h-3 w-3" />
              Duration
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatDuration(session.durationSeconds)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/25">
              <MessagesSquare className="h-3 w-3" />
              Your turns
            </p>
            <p className="mt-1 text-sm font-semibold">
              {session.userMessageCount}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SessionFeedbackView
          feedback={feedback}
          status={session.feedbackStatus}
          sessionId={session.id}
          language={session.language}
        />
      </div>

      <section className="mt-10 border-t border-white/[0.07] pt-8">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/25">
            Conversation transcript
          </p>
          <h2 className="mt-2 text-xl font-semibold">What you actually said</h2>
        </div>
        <SessionTranscript messages={messages} />
      </section>
    </div>
  );
}
