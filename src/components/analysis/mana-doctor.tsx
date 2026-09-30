"use client";

import { Activity, Info, TriangleAlert } from "lucide-react";
import type { ManaReport } from "@/lib/types";
import { COLOR_NAMES } from "@/lib/cards/helpers";
import { ManaSymbol } from "@/components/mtg/mana";
import { MANA_SERIES } from "@/components/analysis/charts";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Mana Base Doctor: demand vs. production per color, source breakdown and phrased concerns. */
export function ManaDoctorPanel({ report }: { report: ManaReport }) {
  const b = report.breakdown;
  const tiles: { label: string; value: number; hint: string }[] = [
    { label: "Lands", value: b.lands, hint: `${b.untappedLands} untapped, ${b.tappedLands} always tapped, ${b.conditionalLands} conditional` },
    { label: "Mana rocks", value: b.manaRocks, hint: "Noncreature artifacts that tap for mana" },
    { label: "Mana dorks", value: b.manaDorks, hint: "Creatures that tap for mana" },
    { label: "Land ramp", value: b.landRamp, hint: "Spells and abilities that put extra lands onto the battlefield" },
    { label: "Treasure makers", value: b.treasureMakers, hint: "Cards that create Treasure" },
    { label: "Color fixers", value: b.fixers, hint: "Nonland cards producing two or more of your colors" },
    { label: "Cost reducers", value: b.costReducers, hint: "Cards that make spells or abilities cheaper" },
    { label: "MDFC lands", value: b.mdfcLands, hint: "Modal double-faced cards with a land face (counted as half a land)" },
  ];
  return (
    <Panel id="mana-doctor">
      <PanelHeader
        title="Mana Base Doctor"
        icon={<Activity />}
        description={`Colored demand vs. production. Hybrid pips count half toward each color, Phyrexian pips count as the color, and ${report.genericPips} generic pips are not shown. Suggested land range for this curve and ramp: ${report.suggestedLands.low}–${report.suggestedLands.high}.`}
        actions={<Badge tone={report.concerns.some((c) => c.severity === "warning") ? "warn" : "ok"}>{report.concerns.length ? `${report.concerns.length} potential concern${report.concerns.length === 1 ? "" : "s"}` : "No color gaps"}</Badge>}
      />
      <PanelBody className="grid gap-5">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <Tooltip key={t.label} content={t.hint}>
              <div className="rounded-xl border border-line bg-bg-raised/70 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">{t.label}</dt>
                <dd className="font-display text-xl tabular-nums text-ink">{t.value}</dd>
              </div>
            </Tooltip>
          ))}
        </dl>

        <div className="grid gap-3">
          {report.demand.map((d) => (
            <div key={d.color} className="grid grid-cols-[auto_1fr] items-start gap-3">
              <ManaSymbol symbol={d.color} className="mt-0.5 text-xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-ink-2">
                  <span>
                    {COLOR_NAMES[d.color]} · {d.pips} pips across {d.cards} cards{d.heavyCards ? `, ${d.heavyCards} needing 2+` : ""}
                  </span>
                  <span className="tabular-nums text-muted">
                    {d.sources} sources ({d.landSources} lands, {d.untappedLandSources} untapped)
                  </span>
                </div>
                <div className="mt-1 grid gap-1">
                  <Bar label="Demand" value={d.pipShare} color={MANA_SERIES[d.color]} />
                  <Bar label="Production" value={d.sourceShare} color={MANA_SERIES[d.color]} muted />
                </div>
                <p className={cn("mt-1 text-[11px]", d.gap > 0.12 ? "text-warn" : "text-muted")}>
                  {d.gap > 0.12
                    ? `${COLOR_NAMES[d.color]} is ${pct(d.pipShare)} of colored pips but ${pct(d.sourceShare)} of colored sources.`
                    : d.gap < -0.12
                      ? `${COLOR_NAMES[d.color]} is over-supplied (${pct(d.sourceShare)} of sources for ${pct(d.pipShare)} of pips).`
                      : `Balanced: ${pct(d.pipShare)} of pips, ${pct(d.sourceShare)} of sources.`}
                </p>
              </div>
            </div>
          ))}
          {report.demand.length === 0 && <p className="text-sm text-muted">Choose a commander to compare colored demand with production.</p>}
        </div>

        {(report.concerns.length > 0 || report.notes.length > 0) && (
          <div className="grid gap-2">
            {report.concerns.map((c) => (
              <div key={c.id} className="flex gap-3 rounded-xl border border-line bg-bg-raised/70 p-3">
                {c.severity === "warning" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-label="warning" /> : <Info className="mt-0.5 size-4 shrink-0 text-info" aria-label="note" />}
                <div>
                  <p className="text-sm font-medium text-ink">{c.title}</p>
                  <p className="text-[13px] text-ink-2">{c.detail}</p>
                </div>
              </div>
            ))}
            {report.notes.map((n) => (
              <p key={n} className="px-1 text-[11px] text-muted">
                {n}
              </p>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function Bar({ label, value, color, muted }: { label: string; value: number; color: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-2 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-panel-3">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color, opacity: muted ? 0.55 : 1 }} />
      </span>
      <span className="text-right tabular-nums text-ink-2">{pct(value)}</span>
    </div>
  );
}
