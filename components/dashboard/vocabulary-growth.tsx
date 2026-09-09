import Link from "next/link";

export function VocabularyGrowth({
  saved,
  learning,
  strong,
  due,
  newThisWeek,
  growth,
}: {
  saved: number;
  learning: number;
  strong: number;
  due: number;
  newThisWeek: number;
  growth: Array<{ date: string; count: number }>;
}) {
  const points = growth.reduce<Array<{ date: string; count: number; cumulative: number }>>(
    (result, entry) => [
      ...result,
      {
        ...entry,
        cumulative: (result.at(-1)?.cumulative ?? 0) + entry.count,
      },
    ],
    [],
  );
  const recent = points.slice(-8);
  const maximum = Math.max(1, ...recent.map((point) => point.cumulative));

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
        Vocabulary growth
      </p>
      <h2 className="mt-2 text-xl font-semibold">{saved} saved words</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-xl font-semibold">{learning}</p><p className="text-[11px] text-white/30">Learning</p></div>
        <div><p className="text-xl font-semibold">{strong}</p><p className="text-[11px] text-white/30">Strong</p></div>
        <div><p className="text-xl font-semibold">{due}</p><p className="text-[11px] text-white/30">Due now</p></div>
        <div><p className="text-xl font-semibold">{newThisWeek}</p><p className="text-[11px] text-white/30">New this week</p></div>
      </div>
      {recent.length > 0 && (
        <div
          className="mt-6 flex h-24 items-end gap-2"
          role="img"
          aria-label={`Cumulative saved vocabulary over recent save dates: ${recent.map((point) => `${point.date}: ${point.cumulative}`).join(", ")}`}
        >
          {recent.map((point) => (
            <div
              key={point.date}
              className="flex-1 rounded-t bg-violet-300/50"
              style={{
                height: `${Math.max(10, Math.round((point.cumulative / maximum) * 100))}%`,
              }}
              title={`${point.date}: ${point.cumulative}`}
            />
          ))}
        </div>
      )}
      <Link
        href="/vocabulary"
        className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-semibold text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        {due > 0 ? `Review ${due} due` : "Open vocabulary"}
      </Link>
    </section>
  );
}
