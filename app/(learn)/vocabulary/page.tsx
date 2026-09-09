import Link from "next/link";
import { BookOpenCheck, Brain, Clock3, Layers3 } from "lucide-react";
import { VocabularyItemCard } from "@/components/vocabulary/vocabulary-item-card";
import { getVocabularyViewModel } from "@/lib/learning/server";

export default async function VocabularyPage() {
  const { overview, items } = await getVocabularyViewModel();

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-amber-400">Vocabulary review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Turn conversation words into long-term recall.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40">
            Saved words use a deterministic spaced-repetition schedule. Strong
            means five successful repetitions and a review interval of at least
            21 days—not permanent mastery.
          </p>
        </div>
        <Link
          href="/vocabulary/review"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Review {overview.due > 0 ? `${overview.due} due` : "vocabulary"}
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Saved", overview.saved, Layers3],
          ["Due now", overview.due, Clock3],
          ["Learning", overview.learning, Brain],
          ["Strong", overview.strong, BookOpenCheck],
        ].map(([label, value, Icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
          >
            <Icon className="h-4 w-4 text-amber-300" />
            <p className="mt-4 text-2xl font-semibold">{String(value)}</p>
            <p className="mt-1 text-xs text-white/30">{String(label)}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 text-center sm:p-12">
          <h2 className="text-xl font-semibold">Your vocabulary library is empty.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/40">
            Complete a conversation, open its feedback, and save useful words.
            They will appear here immediately and start due for review.
          </p>
          <Link
            href="/history"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            Browse session feedback
          </Link>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Saved vocabulary</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <VocabularyItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
