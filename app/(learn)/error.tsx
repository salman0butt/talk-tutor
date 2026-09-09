"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function LearningError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-300/10 bg-red-300/[0.035] p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-300/10 text-red-300">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold">Learning data could not be loaded.</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/40">
        Your account and existing sessions have not been changed. Retry the
        request, and if the problem continues verify the Supabase migration
        and environment configuration.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
