import type { FinalTranscriptMessage } from "@/lib/learning/types";

export function SessionTranscript({
  messages,
}: {
  messages: FinalTranscriptMessage[];
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
        No finalized transcript turns were saved for this session.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const user = message.role === "user";
        return (
          <div
            key={message.sequence + "-" + message.role}
            className={user ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                user
                  ? "max-w-[88%] rounded-2xl bg-amber-300 px-4 py-3 text-sm leading-6 text-black sm:max-w-[75%]"
                  : "max-w-[88%] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/75 sm:max-w-[75%]"
              }
            >
              <p
                className={
                  user
                    ? "mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/45"
                    : "mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30"
                }
              >
                {user ? "You" : "Talk Tutor"}
              </p>
              {message.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
