export function WeeklyPractice({
  entries,
}: {
  entries: Array<{ date: string; minutes: number }>;
}) {
  const maximum = Math.max(1, ...entries.map((entry) => entry.minutes));
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/25">
            Weekly practice
          </p>
          <h2 className="mt-2 text-xl font-semibold">Last seven days</h2>
        </div>
        <p className="text-sm font-medium text-amber-200">{total} min</p>
      </div>

      <div className="mt-7 flex h-44 items-end gap-2 sm:gap-3">
        {entries.map((entry) => {
          const height =
            entry.minutes === 0
              ? 4
              : Math.max(10, Math.round((entry.minutes / maximum) * 100));
          const date = new Date(entry.date + "T12:00:00.000Z");
          const day = new Intl.DateTimeFormat("en", { weekday: "short" }).format(
            date,
          );
          return (
            <div
              key={entry.date}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="flex h-[118px] items-end">
                <div
                  className={
                    entry.minutes > 0
                      ? "w-full rounded-t-lg bg-gradient-to-t from-amber-500/40 to-amber-300"
                      : "w-full rounded-t-lg bg-white/[0.05]"
                  }
                  style={{ height: height + "%" }}
                  title={entry.minutes + " minutes"}
                />
              </div>
              <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-wider text-white/25">
                {day}
              </p>
              <p className="mt-1 text-center text-[10px] text-white/35">
                {entry.minutes}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
