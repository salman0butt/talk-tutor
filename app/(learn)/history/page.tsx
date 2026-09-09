import Link from "next/link";
import { BookOpenText, Mic2 } from "lucide-react";
import { SessionCard } from "@/components/history/session-card";
import { getHistoryViewModel } from "@/lib/learning/server";

export default async function HistoryPage() {
  const { profile, sessions } = await getHistoryViewModel();

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-amber-400">Practice history</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Every conversation becomes review material.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Review saved transcripts and structured coaching feedback. Audio
            is not recorded or stored.
          </p>
        </div>
        <Link
          href="/tutor"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <Mic2 className="h-4 w-4" />
          Practice now
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
            <BookOpenText className="h-6 w-6" />
          </div>
          <h2 className="mt-5 font-semibold">No completed sessions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
            Start a real speaking session. Once you say something and finish
            the conversation, its finalized transcript will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              timezone={profile.timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
