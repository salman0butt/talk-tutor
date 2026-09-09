import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/30">
          {label}
        </p>
        <Icon className="h-4 w-4 text-amber-300/70" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-white/30">{detail}</p>}
    </article>
  );
}
