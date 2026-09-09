const labels: Record<string, string> = {
  articles: "Articles",
  verb_tense: "Verb tense",
  prepositions: "Prepositions",
  word_order: "Word order",
  pluralization: "Pluralization",
  vocabulary_misuse: "Vocabulary misuse",
  agreement: "Agreement",
  other: "Other",
};

export function CommonMistakes({
  mistakes,
}: {
  mistakes: Array<{ category: string; count: number }>;
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
          Recurring grammar categories will appear after structured feedback
          has been generated for your sessions.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((row) => (
            <div key={row.category}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/60">
                  {labels[row.category] ?? row.category.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-white/30">
                  {row.count} {row.count === 1 ? "correction" : "corrections"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-amber-300/70"
                  style={{ width: Math.round((row.count / maximum) * 100) + "%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
