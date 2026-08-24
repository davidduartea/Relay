import { formatDay } from "@/lib/format-time";

/** El corte entre dos días de conversación. */
export function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="bg-rule h-px flex-1" />
      <span className="text-ink-muted text-xs font-semibold tracking-[0.14em] uppercase">
        {formatDay(iso)}
      </span>
      <span aria-hidden="true" className="bg-rule h-px flex-1" />
    </div>
  );
}
