import { SessionCard } from "@/components/history/session-card";
import type { LearningSessionSummary } from "@/lib/learning/types";

export function RecentSessions({
  sessions,
  timezone,
}: {
  sessions: LearningSessionSummary[];
  timezone: string;
}) {
  if (sessions.length === 0) return null;

  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
          Recent sessions
        </p>
        <h2 className="mt-2 text-xl font-semibold">Keep the thread going</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sessions.slice(0, 3).map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            timezone={timezone}
          />
        ))}
      </div>
    </section>
  );
}
