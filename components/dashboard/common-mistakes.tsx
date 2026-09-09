import Link from "next/link";

const labels: Record<string, string> = {
  articles: "Articles",
  verb_tense: "Verb tense",
  prepositions: "Prepositions",
  word_order: "Word order",
  pluralization: "Pluralization",
  vocabulary_misuse: "Vocabulary misuse",
  agreement: "Subject-verb agreement",
  other: "Other",
};

function trendLabel(row: {
  recentCount: number;
  previousCount: number;
}) {
  if (row.recentCount < 2 || row.previousCount < 2) return null;
  if (row.recentCount < row.previousCount) return "↓ Improving";
  if (row.recentCount > row.previousCount) return "↑ Needs practice";
  return "→ Stable";
}

export function CommonMistakes({
  mistakes,
}: {
  mistakes: Array<{
    category: string;
    count: number;
    affectedSessions: number;
    recentCount: number;
    previousCount: number;
  }>;
}) {
  const rows = mistakes.slice(0, 5);
  const maximum = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
        Common mistakes
      </p>
      <h2 className="mt-2 text-xl font-semibold">Patterns worth revisiting</h2>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm leading-6 text-white/35">
          No recurring grammar pattern is established yet. Keep practicing
          naturally and structured feedback will surface useful targets.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {rows.map((row) => {
              const trend = trendLabel(row);
              return (
                <div key={row.category}>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <span className="text-white/65">
                        {labels[row.category] ??
                          row.category.replaceAll("_", " ")}
                      </span>
                      <p className="mt-1 text-[11px] text-white/25">
                        {row.count} {row.count === 1 ? "correction" : "corrections"} ·{" "}
                        {row.affectedSessions}{" "}
                        {row.affectedSessions === 1 ? "session" : "sessions"}
                      </p>
                    </div>
                    <span className="text-[11px] text-white/35">
                      {trend ?? "More data needed"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-amber-300/70"
                      style={{
                        width:
                          Math.round((row.count / maximum) * 100) + "%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/tutor?mode=mistakes"
            className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            Practice my mistakes
          </Link>
        </>
      )}
    </section>
  );
}
