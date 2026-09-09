"use client";

import { useState } from "react";
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from "lucide-react";

export function SaveWordButton({
  term,
  meaning,
  exampleSentence,
  language,
  sessionId,
}: {
  term: string;
  meaning: string;
  exampleSentence?: string;
  language: string;
  sessionId: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      const response = await fetch("/api/learning/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          meaning,
          exampleSentence,
          language,
          sourceSessionId: sessionId,
          sourceContext: exampleSentence ?? null,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "saving" || state === "saved"}
      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:opacity-60"
      aria-live="polite"
    >
      {state === "saving" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : state === "saved" ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <BookmarkPlus className="h-3.5 w-3.5" />
      )}
      {state === "saved"
        ? "Saved"
        : state === "error"
          ? "Retry save"
          : state === "saving"
            ? "Saving..."
            : "Save word"}
    </button>
  );
}
