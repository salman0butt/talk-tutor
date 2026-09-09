export default function ProfileLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-28 rounded bg-white/10" />
      <div className="mt-4 h-10 w-2/3 max-w-xl rounded bg-white/10" />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="h-[430px] rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="h-[430px] rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
      </div>
    </div>
  );
}
