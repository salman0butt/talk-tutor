import Link from "next/link";
import type { PracticeRecommendation } from "@/lib/learning/recommendations";

export function RecommendedPractice({
  recommendations,
}: {
  recommendations: PracticeRecommendation[];
}) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
        Recommended practice
      </p>
      <h2 className="mt-2 text-xl font-semibold">What should I practice next?</h2>
      <div className="mt-5 space-y-3">
        {recommendations.map((item) => (
          <Link
            key={item.kind}
            href={item.href}
            className="block rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            <p className="text-sm font-medium text-white/75">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-white/35">{item.reason}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
