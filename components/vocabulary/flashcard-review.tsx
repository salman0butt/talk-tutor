"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import type { SavedVocabularyItem } from "@/lib/learning/vocabulary";
import type { VocabularyReviewRating } from "@/lib/learning/spaced-repetition";

const ratings: Array<{
  rating: VocabularyReviewRating;
  label: string;
  key: string;
  hint: string;
}> = [
  { rating: "again", label: "Again", key: "1", hint: "I forgot it" },
  { rating: "hard", label: "Hard", key: "2", hint: "Difficult recall" },
  { rating: "good", label: "Good", key: "3", hint: "Correct recall" },
  { rating: "easy", label: "Easy", key: "4", hint: "Immediate recall" },
];

export function FlashcardReview({\n  initialItems,\n  nextDueAt,\n}: {\n  initialItems: SavedVocabularyItem[];\n  nextDueAt: string | null;\n}) {
  const [items, setItems] = useState(initialItems);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextScheduledAt, setNextScheduledAt] = useState(nextDueAt);

  const current = items[0];
  const completed = initialItems.length - items.length;

  const grade = useCallback(
    async (rating: VocabularyReviewRating) => {
      if (!current || !revealed || busy) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `/api/learning/vocabulary/${current.id}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Could not save this review.");
        }
        const candidate = payload?.review?.nextReviewAt;
        if (
          typeof candidate === "string" &&
          !Number.isNaN(Date.parse(candidate))
        ) {
          setNextScheduledAt((existing) => {
            if (!existing || Number.isNaN(Date.parse(existing))) return candidate;
            return Date.parse(candidate) < Date.parse(existing)
              ? candidate
              : existing;
          });
        }
        setItems((existing) => existing.slice(1));
        setRevealed(false);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Could not save this review.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, current, revealed],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || busy) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const option = ratings.find((item) => item.key === event.key);
        if (option) {
          event.preventDefault();
          void grade(option.rating);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, current, grade, revealed]);

  const progress = useMemo(
    () =>
      initialItems.length === 0
        ? 100
        : Math.round((completed / initialItems.length) * 100),
    [completed, initialItems.length],
  );

  if (!current) {
    return (
      <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.04] p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
        <h2 className="mt-4 text-2xl font-semibold">Review complete</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/40">
          {nextScheduledAt
            ? `You are caught up for now. The next saved card is scheduled for ${new Date(nextScheduledAt).toLocaleString()}.`
            : "You are caught up for now. No future review is currently scheduled."}
        </p>
        <Link
          href="/vocabulary"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Back to vocabulary
        </Link>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 text-xs text-white/35">
        <span>
          {completed + 1} of {initialItems.length}
        </span>
        <span>{progress}% complete</span>
      </div>
      <div
        className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-7 sm:p-10"
        aria-live="polite"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-white/25">
          {current.language}
        </p>
        <h2 className="mt-5 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          {current.term}
        </h2>

        {!revealed ? (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="min-h-12 rounded-xl bg-amber-400 px-6 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Reveal answer
            </button>
            <p className="mt-3 text-xs text-white/25">Space or Enter</p>
          </div>
        ) : (
          <div className="mt-9 border-t border-white/[0.07] pt-7">
            <p className="text-base leading-7 text-white/75">{current.meaning}</p>
            {current.exampleSentence && (
              <p className="mt-4 text-sm italic leading-6 text-white/40">
                “{current.exampleSentence}”
              </p>
            )}
            {current.personalizedExample && (
              <div className="mt-4 rounded-xl bg-amber-300/[0.06] p-4">
                <p className="text-xs font-medium text-amber-200">
                  From your learning context
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {current.personalizedExample}
                </p>
              </div>
            )}

            <fieldset className="mt-8">
              <legend className="mb-3 text-xs text-white/35">
                How well did you recall it?
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ratings.map((item) => (
                  <button
                    key={item.rating}
                    type="button"
                    onClick={() => void grade(item.rating)}
                    disabled={busy}
                    className="min-h-14 rounded-xl border border-white/10 px-3 text-left transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:opacity-50"
                  >
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-1 block text-[10px] text-white/30">
                      {item.key} · {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {busy && (
          <p className="mt-4 flex items-center gap-2 text-xs text-white/35">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Saving review…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
