import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FlashcardReview } from "@/components/vocabulary/flashcard-review";
import { getVocabularyReviewViewModel } from "@/lib/learning/server";

export default async function VocabularyReviewPage() {
  const { overview, items } = await getVocabularyReviewViewModel();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/vocabulary"
        className="inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Vocabulary
      </Link>
      <div className="mt-6">
        <p className="text-sm font-medium text-amber-400">Spaced repetition</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Review what is due now.
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/40">
          Reveal first, then grade your recall. Ratings directly change the
          next deterministic review date.
        </p>
      </div>
      <div className="mt-8">
        <FlashcardReview initialItems={items} nextDueAt={overview.nextDueAt} />
      </div>
    </div>
  );
}
