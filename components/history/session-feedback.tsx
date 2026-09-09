import {
  ArrowRight,
  BookOpenCheck,
  MessageCircleMore,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { FeedbackStatus, SessionFeedback } from "@/lib/learning/types";
import { FeedbackRetryButton } from "@/components/history/feedback-retry-button";

export function SessionFeedbackView({
  feedback,
  status,
  sessionId,
}: {
  feedback: SessionFeedback | null;
  status: FeedbackStatus;
  sessionId: string;
}) {
  if (!feedback) {
    const failed = status === "failed";
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div
            className={
              failed
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-300"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"
            }
          >
            {failed ? (
              <TriangleAlert className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">
              {failed
                ? "Feedback generation failed"
                : "Feedback is being prepared"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">
              {failed
                ? "Your completed session and transcript are safe. Retry the AI review whenever you want."
                : "Your transcript is already saved. Structured grammar, vocabulary, and fluency feedback will appear here when generation finishes."}
            </p>
            {failed && (
              <div className="mt-4">
                <FeedbackRetryButton sessionId={sessionId} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.05] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/70">
          Overall feedback
        </p>
        <p className="mt-4 text-base leading-7 text-white/80 sm:text-lg">
          {feedback.summary}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-lg font-bold text-black">
            {feedback.fluency.score}
          </div>
          <div>
            <p className="text-sm font-medium">Fluency coaching score</p>
            <p className="mt-1 text-xs text-white/35">
              Text-based coaching signal, not a pronunciation or exam score.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/50">
          {feedback.fluency.summary}
        </p>
      </section>

      {feedback.grammarCorrections.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-amber-300" />
            <h2 className="font-semibold">Grammar corrections</h2>
          </div>
          <div className="space-y-3">
            {feedback.grammarCorrections.map((correction, index) => (
              <article
                key={correction.category + "-" + index}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
              >
                <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-wider text-white/35">
                  {correction.category.replaceAll("_", " ")}
                </span>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Original
                    </p>
                    <p className="mt-1 text-sm text-red-200/80">
                      {correction.original}
                    </p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-white/20 md:block" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Better
                    </p>
                    <p className="mt-1 text-sm text-emerald-200/90">
                      {correction.corrected}
                    </p>
                  </div>
                </div>
                <p className="mt-4 border-t border-white/[0.06] pt-4 text-sm leading-6 text-white/45">
                  {correction.explanation}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {feedback.betterSentences.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <MessageCircleMore className="h-4 w-4 text-violet-300" />
            <h2 className="font-semibold">More natural ways to say it</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {feedback.betterSentences.map((item, index) => (
              <article
                key={index}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
              >
                <p className="text-sm text-white/35 line-through decoration-white/15">
                  {item.original}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-white/80">
                  {item.suggestion}
                </p>
                {item.reason && (
                  <p className="mt-3 text-xs leading-5 text-white/35">
                    {item.reason}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {feedback.vocabulary.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold">
            Vocabulary from this conversation
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {feedback.vocabulary.map((item, index) => (
              <article
                key={item.term + "-" + index}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
              >
                <p className="font-semibold text-amber-200">{item.term}</p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {item.meaning}
                </p>
                {item.example && (
                  <p className="mt-3 text-xs italic leading-5 text-white/30">
                    “{item.example}”
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {feedback.nextSteps.length > 0 && (
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
          <h2 className="font-semibold">Next practice focus</h2>
          <ol className="mt-4 space-y-3">
            {feedback.nextSteps.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 text-sm leading-6 text-white/55"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/10 text-[11px] font-semibold text-amber-300">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
