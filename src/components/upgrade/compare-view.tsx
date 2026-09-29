"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import type { DeckAnalysis, UpgradeGoal } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SERIES, legendText } from "@/components/analysis/charts";

type Direction = "up-good" | "down-good" | "neutral";
interface Metric {
  label: string;
  before: number;
  after: number;
  format?: (n: number) => string;
  direction: Direction;
  note?: string;
}

/** Side-by-side comparison of the current deck and the proposed upgrade. */
export function CompareView({ before, after, goals }: { before: DeckAnalysis; after: DeckAnalysis; goals: UpgradeGoal[] }) {
  const metrics: Metric[] = [
    { label: "Lands", before: before.landCount, after: after.landCount, direction: "neutral" },
    { label: "Ramp", before: before.categories.Ramp.length, after: after.categories.Ramp.length, direction: "up-good" },
    { label: "Card draw", before: before.categories["Card Draw"].length, after: after.categories["Card Draw"].length, direction: "up-good" },
    { label: "Removal", before: before.categories["Targeted Removal"].length, after: after.categories["Targeted Removal"].length, direction: "up-good" },
    { label: "Board wipes", before: before.categories["Board Wipes"].length, after: after.categories["Board Wipes"].length, direction: "up-good" },
    {
      label: "Avg mana value",
      before: before.averageManaValue,
      after: after.averageManaValue,
      format: (n) => n.toFixed(2),
      direction: goals.includes("Lower Mana Curve") ? "down-good" : "neutral",
    },
    { label: "Est. price", before: before.totalPrice, after: after.totalPrice, format: (n) => formatPrice(n), direction: "neutral", note: "Deck value, not cost to buy" },
  ];
  const curve = before.manaCurve.map((row, i) => ({ mv: row.mv, Current: row.count, Proposed: after.manaCurve[i].count }));
  const themesBefore = new Map(before.themes.map((t) => [t.id, t.score]));

  return (
    <Panel>
      <PanelHeader title="Compare: current vs. proposed" description="What changes if you commit the accepted swaps. These are tradeoffs to weigh, not a verdict." />
      <PanelBody className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <table className="w-full text-sm">
          <caption className="sr-only">Deck statistics before and after the proposed swaps</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 font-medium">Metric</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Current</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Proposed</th>
              <th scope="col" className="py-2 pl-3 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const diff = m.after - m.before;
              const fmt = m.format ?? String;
              const changed = Math.abs(diff) > 1e-6;
              const good = (m.direction === "up-good" && diff > 0) || (m.direction === "down-good" && diff < 0);
              const trade = (m.direction === "up-good" && diff < 0) || (m.direction === "down-good" && diff > 0);
              return (
                <tr key={m.label} className="border-b border-line/50">
                  <th scope="row" className="py-2 text-left font-normal text-ink-2">
                    {m.label}
                    {m.note && <span className="block text-[10px] text-muted">{m.note}</span>}
                  </th>
                  <td className="py-2 text-right tabular-nums text-ink-2">{fmt(m.before)}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{fmt(m.after)}</td>
                  <td className="py-2 pl-3">
                    {!changed ? (
                      <span className="text-xs text-muted">Same</span>
                    ) : (
                      <Badge tone={good ? "ok" : trade ? "warn" : "neutral"}>
                        {diff > 0 ? "+" : "−"}
                        {fmt(Math.abs(diff))}
                        {good ? " · gain" : trade ? " · tradeoff" : ""}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Mana curve (nonland)</p>
            <div className="h-52" role="img" aria-label="Mana curve comparison. The table lists the key numbers.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke="#2d2731" />
                  <XAxis dataKey="mv" tick={{ fill: "#948a7d", fontSize: 12 }} axisLine={{ stroke: "#2d2731" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#948a7d", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RTooltip
                    contentStyle={{ background: "#2d2731", border: "1px solid #4a4150", borderRadius: 10, color: "#ece3cf", fontSize: 12 }}
                    cursor={{ fill: "#ffffff08" }}
                    labelFormatter={(l) => `Mana value ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={legendText} />
                  <Bar dataKey="Current" fill={SERIES.secondary} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Proposed" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Theme strength</p>
            <ul className="flex flex-wrap gap-1.5">
              {after.themes.slice(0, 8).map((t) => {
                const prev = themesBefore.get(t.id) ?? 0;
                const d = t.score - prev;
                return (
                  <li key={t.id}>
                    <Badge tone={d > 0 ? "ok" : d < 0 ? "warn" : "neutral"}>
                      {t.name} {t.score}
                      {d !== 0 && ` (${d > 0 ? "+" : ""}${d})`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
