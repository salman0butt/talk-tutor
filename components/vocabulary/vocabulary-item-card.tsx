"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SavedVocabularyItem } from "@/lib/learning/vocabulary";

export function VocabularyItemCard({ item }: { item: SavedVocabularyItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"delete" | "example" | null>(null);
  const [error, setError] = useState("");
  const [example, setExample] = useState(item.personalizedExample);
  const [explanation, setExplanation] = useState(item.personalizedExplanation);

  async function remove() {
    setBusy("delete");
    setError("");
    try {
      const response = await fetch(`/api/learning/vocabulary/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove this word.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove this word.");
      setBusy(null);
    }
  }

  async function generateExample() {
    setBusy("example");
    setError("");
    try {
      const response = await fetch(
        `/api/learning/vocabulary/${item.id}/example`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not generate an example.");
      }
      setExample(payload.example?.sentence ?? null);
      setExplanation(payload.example?.explanation ?? null);
      setBusy(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not generate an example.",
      );
      setBusy(null);
    }
  }

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-amber-200">{item.term}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/25">
            {item.language} · {item.status}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          aria-label={`Remove ${item.term} from vocabulary`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition hover:bg-red-300/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 disabled:opacity-50"
        >
          {busy === "delete" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/50">{item.meaning}</p>
      {item.exampleSentence && (
        <p className="mt-3 text-xs italic leading-5 text-white/30">
          “{item.exampleSentence}”
        </p>
      )}
      {example && (
        <div className="mt-4 rounded-xl bg-amber-300/[0.06] p-3">
          <p className="text-xs font-medium text-amber-100">Personalized example</p>
          <p className="mt-2 text-sm leading-6 text-white/65">{example}</p>
          {explanation && (
            <p className="mt-2 text-xs leading-5 text-white/35">{explanation}</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!example && (
          <button
            type="button"
            onClick={generateExample}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:opacity-50"
          >
            {busy === "example" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Personalized example
          </button>
        )}
        {item.sourceSessionId && (
          <Link
            href={`/history/${item.sourceSessionId}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs text-white/45 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            Source session
          </Link>
        )}
      </div>
      <p className="mt-4 text-[11px] text-white/25">
        Next review: {new Date(item.nextReviewAt).toLocaleString()}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </article>
  );
}
