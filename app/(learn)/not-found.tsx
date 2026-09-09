import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function LearningNotFound() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-white/40">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold">Session not found</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/35">
        This session does not exist or is not available to your account.
      </p>
      <Link
        href="/history"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to history
      </Link>
    </div>
  );
}
