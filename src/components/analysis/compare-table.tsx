"use client";

import { ArrowRight } from "lucide-react";
import type { DeckAnalysis } from "@/lib/types";
import { compareAnalyses, formatMetric, type MetricDelta } from "@/lib/analysis/compare";
import { cn } from "@/components/ui/utils";

const GROUP_LABELS: Record<MetricDelta["group"], string> = {
  overview: "Overview",
  roles: "Functional roles",
  themes: "Theme strength",
  mana: "Mana",
  wincons: "Win conditions",
};

/** Before → after list of the metrics that changed, grouped. */
export function CompareTable({
  before,
  after,
  labels = ["Before", "After"],
  onlyChanged = true,
  className,
}: {
  before: DeckAnalysis;
  after: DeckAnalysis;
  labels?: [string, string];
  onlyChanged?: boolean;
  className?: string;
}) {
  const cmp = compareAnalyses(before, after);
  const rows = onlyChanged ? cmp.changed : cmp.metrics;
  if (!rows.length) return <p className={cn("text-sm text-muted", className)}>No measurable change.</p>;
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div className={cn("grid gap-4", className)}>
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{GROUP_LABELS[g]}</p>
          <ul className="divide-y divide-line/60 rounded-xl border border-line bg-bg-raised/60">
            {rows
              .filter((r) => r.group === g)
              .map((r) => (
                <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="truncate text-ink-2">{r.label}</span>
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted" title={labels[0]}>{formatMetric(r.before, r.format)}</span>
                    <ArrowRight className="size-3 text-muted" aria-label="to" />
                    <span className="text-ink" title={labels[1]}>{formatMetric(r.after, r.format)}</span>
                    <DeltaBadge delta={r.delta} format={r.format} higherIsBetter={r.higherIsBetter} />
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DeltaBadge({ delta, format, higherIsBetter }: { delta: number; format: MetricDelta["format"]; higherIsBetter?: boolean }) {
  if (delta === 0) return <span className="w-14 text-right text-xs text-muted">±0</span>;
  const good = higherIsBetter === undefined ? undefined : higherIsBetter ? delta > 0 : delta < 0;
  const text = `${delta > 0 ? "+" : "−"}${formatMetric(Math.abs(delta), format)}`;
  return (
    <span className={cn("w-14 rounded-md px-1.5 py-0.5 text-right text-xs", good === undefined ? "bg-panel-3 text-ink-2" : good ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>
      {text}
    </span>
  );
}
