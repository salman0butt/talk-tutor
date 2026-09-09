export default function VocabularyLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="mt-4 h-10 w-2/3 rounded bg-white/10" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-56 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
