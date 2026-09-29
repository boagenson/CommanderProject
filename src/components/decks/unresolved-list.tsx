import type { UnresolvedCard } from "@/lib/types";
import type { ParseError } from "@/lib/deck/parser";
import { TriangleAlert, X } from "lucide-react";

/** Lists decklist lines that couldn't be parsed or found on Scryfall. */
export function UnresolvedList({
  unresolved,
  parseErrors = [],
  onDismiss,
}: {
  unresolved: UnresolvedCard[];
  parseErrors?: ParseError[];
  onDismiss?: (index?: number) => void;
}) {
  if (!unresolved.length && !parseErrors.length) return null;
  return (
    <div role="status" className="rounded-xl border border-warn/40 bg-warn/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <TriangleAlert className="size-4 text-warn" aria-hidden />
          {unresolved.length + parseErrors.length} line{unresolved.length + parseErrors.length === 1 ? "" : "s"} couldn&apos;t be added
        </p>
        {onDismiss && unresolved.length > 0 && (
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => onDismiss()}>
            Dismiss all
          </button>
        )}
      </div>
      <ul className="grid gap-1.5 text-[13px]">
        {unresolved.map((u, i) => (
          <li key={`u${i}`} className="flex items-start justify-between gap-3 rounded-lg bg-bg-raised/70 px-3 py-2">
            <span className="min-w-0">
              <span className="font-mono text-ink">{u.line}</span>
              <span className="block text-xs text-muted">{u.reason}</span>
            </span>
            {onDismiss && (
              <button type="button" aria-label={`Dismiss ${u.name}`} onClick={() => onDismiss(i)} className="text-muted hover:text-ink">
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
        {parseErrors.map((e) => (
          <li key={`p${e.lineNumber}`} className="rounded-lg bg-bg-raised/70 px-3 py-2">
            <span className="font-mono text-ink">{e.line.trim()}</span>
            <span className="block text-xs text-muted">Line {e.lineNumber}: {e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
