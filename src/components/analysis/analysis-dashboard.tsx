"use client";

import { ChevronDown, CircleCheck, Info, TriangleAlert, CircleX } from "lucide-react";
import { useState } from "react";
import type { Color, Deck, DeckAnalysis, FunctionalCategory, HealthDiagnostic } from "@/lib/types";
import { COLORS, FUNCTIONAL_CATEGORIES } from "@/lib/types";
import { COLOR_NAMES, formatPrice } from "@/lib/cards/helpers";
import { commanderIdentity } from "@/lib/rules/commander";
import { useDeckStore } from "@/lib/state/deck-store";
import { ManaSymbol } from "@/components/mtg/mana";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/components/ui/utils";
import { ChartPanel, HorizontalBars, MANA_SERIES, ManaCurveChart, PipsVsSourcesChart } from "./charts";
import { ManaDoctorPanel } from "./mana-doctor";

export function AnalysisDashboard({ deck, analysis: a, onOpenCard }: { deck: Deck; analysis: DeckAnalysis; onOpenCard: (name: string) => void }) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const identity = commanderIdentity(deck.commanders.map((c) => c.card));

  const typeRows = (Object.entries(a.typeCounts) as [string, number][])
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: plural(k), value: v }));
  const colorRows = ([...COLORS, "Colorless", "Multicolor"] as const)
    .filter((k) => a.colorCounts[k] > 0)
    .map((k) => ({ key: k, label: k.length === 1 ? COLOR_NAMES[k as Color] : k, value: a.colorCounts[k] }));
  const pipTotal = COLORS.reduce((n, c) => n + a.manaProduction.pips[c], 0);
  const srcTotal = COLORS.reduce((n, c) => n + a.manaProduction.sources[c], 0);
  const manaRows = (identity.length ? identity : COLORS).map((c) => ({
    label: COLOR_NAMES[c],
    color: c,
    pips: pct(a.manaProduction.pips[c], pipTotal),
    sources: pct(a.manaProduction.sources[c], srcTotal),
    pipCount: Math.round(a.manaProduction.pips[c] * 10) / 10,
    sourceCount: a.manaProduction.sources[c],
    landSources: a.manaProduction.landSources[c],
  }));

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: "Cards", value: `${a.totalCards}`, hint: "Including commanders" },
    { label: "Lands", value: `${a.landCount}` },
    { label: "Avg mana value", value: a.averageManaValue.toFixed(2), hint: "Nonland cards" },
    { label: "Ramp", value: `${a.categories.Ramp.length}` },
    { label: "Card draw", value: `${a.categories["Card Draw"].length}` },
    { label: "Removal", value: `${a.categories["Targeted Removal"].length}`, hint: "Targeted" },
    { label: "Board wipes", value: `${a.categories["Board Wipes"].length}` },
    {
      label: "Est. value",
      value: a.pricedCards ? formatPrice(a.totalPrice, currency) : "—",
      hint: a.pricedCards < a.totalCards ? `${a.totalCards - a.pricedCards} unpriced` : undefined,
    },
  ];

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {tiles.map((t, i) => (
          <div key={t.label} className="rounded-2xl border border-line bg-panel/90 px-4 py-3 animate-rise" style={{ animationDelay: `${i * 30}ms` }}>
            <dt className="text-[11px] uppercase tracking-wider text-muted">{t.label}</dt>
            <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{t.value}</dd>
            {t.hint && <dd className="text-[11px] text-muted">{t.hint}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <ChartPanel
          title="Mana curve"
          description="Nonland cards by mana value. Lands are excluded."
          rows={a.manaCurve}
          columns={[
            { key: "mv", label: "Mana value" },
            { key: "creatures", label: "Creatures" },
            { key: "other", label: "Noncreature" },
            { key: "count", label: "Total" },
          ]}
        >
          <ManaCurveChart data={a.manaCurve} />
        </ChartPanel>
        <HealthPanel diagnostics={a.health} onOpenCard={onOpenCard} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <ChartPanel title="Card types" description="Cards with two types count for both." rows={typeRows} columns={[{ key: "label", label: "Type" }, { key: "value", label: "Cards" }]}>
          <HorizontalBars data={typeRows} />
        </ChartPanel>
        <ChartPanel title="Card colors" description="Nonland cards by color." rows={colorRows} columns={[{ key: "label", label: "Color" }, { key: "value", label: "Cards" }]}>
          <HorizontalBars data={colorRows} colorFor={(r) => MANA_SERIES[r.key ?? "C"]} />
        </ChartPanel>
        <ChartPanel
          title="Mana requirements vs. production"
          description="Colored pips in spell costs compared with sources that can make each color."
          rows={manaRows}
          columns={[
            { key: "label", label: "Color" },
            { key: "pipCount", label: "Pips" },
            { key: "sourceCount", label: "All sources" },
            { key: "landSources", label: "Land sources" },
            { key: "pips", label: "Pip share %" },
            { key: "sources", label: "Source share %" },
          ]}
        >
          <PipsVsSourcesChart data={manaRows} />
        </ChartPanel>
      </div>

      <ManaDoctorPanel report={a.mana} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <ManaSourcesPanel rows={manaRows} />
        <CategoriesPanel analysis={a} onOpenCard={onOpenCard} />
      </div>
    </div>
  );
}

function ManaSourcesPanel({
  rows,
}: {
  rows: { label: string; color: Color; pipCount: number; sourceCount: number; landSources: number; pips: number; sources: number }[];
}) {
  return (
    <Panel>
      <PanelHeader as="h3" title="Mana production" description="How many cards can produce each of your colors." />
      <PanelBody className="grid gap-3">
        {rows.map((r) => {
          const gap = r.pips - r.sources;
          return (
            <div key={r.color} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <ManaSymbol symbol={r.color} className="text-xl" />
              <div>
                <div className="flex justify-between text-xs text-ink-2">
                  <span>{r.label}</span>
                  <span className="tabular-nums text-muted">
                    {r.sourceCount} sources ({r.landSources} lands) · {r.pipCount} pips
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.sources)}%`, background: MANA_SERIES[r.color] }} />
                </div>
              </div>
              <span className={cn("text-xs tabular-nums", gap > 15 ? "text-warn" : "text-muted")} title="Pip share minus source share">
                {gap > 15 ? `short ${gap}%` : "ok"}
              </span>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

const severityIcon = { error: CircleX, warning: TriangleAlert, info: Info } as const;
const severityClass = { error: "text-danger", warning: "text-warn", info: "text-info" } as const;

export function HealthPanel({ diagnostics, onOpenCard }: { diagnostics: HealthDiagnostic[]; onOpenCard?: (name: string) => void }) {
  const healthy = diagnostics.length === 1 && diagnostics[0].id === "healthy";
  return (
    <Panel>
      <PanelHeader
        as="h3"
        title="Deck health"
        description="Suggestions based on common Commander guidelines, not hard rules."
        icon={healthy ? <CircleCheck /> : <TriangleAlert />}
      />
      <PanelBody className="grid gap-2">
        {diagnostics.map((d) => {
          const Icon = d.id === "healthy" ? CircleCheck : severityIcon[d.severity];
          return (
            <div key={d.id} className="flex gap-3 rounded-xl border border-line bg-bg-raised/70 p-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", d.id === "healthy" ? "text-ok" : severityClass[d.severity])} aria-label={d.severity} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{d.title}</p>
                <p className="text-[13px] text-ink-2">{d.detail}</p>
                {d.cards && d.cards.length > 0 && onOpenCard && d.id !== "rule-unresolved" && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {d.cards.slice(0, 12).map((c) => (
                      <button key={c} type="button" onClick={() => onOpenCard(c)} className="rounded bg-panel-3 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-gold-strong">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

function CategoriesPanel({ analysis, onOpenCard }: { analysis: DeckAnalysis; onOpenCard: (name: string) => void }) {
  const [open, setOpen] = useState<FunctionalCategory | null>("Ramp");
  const max = Math.max(1, ...FUNCTIONAL_CATEGORIES.map((c) => analysis.categories[c].length));
  return (
    <Panel>
      <PanelHeader
        as="h3"
        title="Functional categories"
        description="Detected from rules text. Open a card to correct its categories; cards can be in several."
      />
      <PanelBody className="grid gap-1">
        {FUNCTIONAL_CATEGORIES.map((cat) => {
          const cards = analysis.categories[cat];
          const expanded = open === cat;
          return (
            <div key={cat} className="rounded-lg">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : cat)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[9.5rem_1fr_2rem_1rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-3/60"
              >
                <span className="text-ink-2">{cat}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${(cards.length / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink">{cards.length}</span>
                <ChevronDown className={cn("size-4 text-muted transition-transform", expanded && "rotate-180")} aria-hidden />
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                  {cards.length ? (
                    cards.map((name) => {
                      const manual = analysis.cardCategories[name]?.manual.includes(cat);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onOpenCard(name)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs transition-colors hover:border-gold/60 hover:text-gold-strong",
                            manual ? "border-gold/50 text-gold-strong" : "border-line text-ink-2",
                          )}
                          title={manual ? "Set manually" : undefined}
                        >
                          {name}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted">No cards detected.</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const plural = (t: string) => (t === "Sorcery" ? "Sorceries" : `${t}s`);
