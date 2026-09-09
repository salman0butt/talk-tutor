export default function HistoryLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-28 rounded bg-white/10" />
      <div className="mt-4 h-9 w-2/3 max-w-xl rounded bg-white/10" />
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-52 rounded-2xl border border-white/[0.06] bg-white/[0.025]"
          />
        ))}
      </div>
    </div>
  );
}
