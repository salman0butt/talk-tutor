export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="mt-4 h-12 w-2/3 max-w-2xl rounded bg-white/10" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 rounded-2xl border border-white/[0.06] bg-white/[0.025]"
          />
        ))}
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <div className="h-72 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="h-72 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
      </div>
    </div>
  );
}
