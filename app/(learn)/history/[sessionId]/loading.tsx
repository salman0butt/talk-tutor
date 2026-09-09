export default function SessionLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-24 rounded bg-white/10" />
      <div className="mt-8 h-10 w-1/2 rounded bg-white/10" />
      <div className="mt-10 h-64 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
      <div className="mt-6 h-80 rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
    </div>
  );
}
