"use client";

import { Link2, Sparkles } from "lucide-react";
import type { DeckTheme } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

/** Detected deck themes with their cards and card-to-card interactions. */
export function ThemesPanel({ themes, onOpenCard }: { themes: DeckTheme[]; onOpenCard: (name: string) => void }) {
  if (!themes.length) {
    return (
      <EmptyState icon={<Sparkles />} title="No strong themes detected yet">
        Themes appear once several cards share a mechanic, such as Food, Treasure, tokens or sacrifice.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader title="Deck themes" icon={<Sparkles />} description="Strength is relative to this deck's size, based on enablers, payoffs and interactions." />
        <PanelBody>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-bg-raised/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <a href={`#theme-${t.id}`} className="font-display text-sm text-ink hover:text-gold-strong">
                    {t.name}
                  </a>
                  <span className="text-xs tabular-nums text-muted">{t.score}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-3" role="meter" aria-valuenow={t.score} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} strength`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-strong" style={{ width: `${t.score}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">{t.cards.length} cards</p>
              </li>
            ))}
          </ol>
        </PanelBody>
      </Panel>

      {themes.map((t) => {
        const enablers = t.cards.filter((c) => c.role !== "payoff");
        const payoffs = t.cards.filter((c) => c.role !== "enabler");
        return (
          <Panel key={t.id} id={`theme-${t.id}`} className="scroll-mt-24">
            <PanelHeader title={t.name} description={t.description} actions={<Badge tone="gold">Strength {t.score}</Badge>} />
            <PanelBody className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid content-start gap-4">
                <CardGroup label="Enablers" hint="Produce the resource or event" names={enablers.map((c) => c.name)} onOpenCard={onOpenCard} />
                <CardGroup label="Payoffs" hint="Reward it" names={payoffs.map((c) => c.name)} onOpenCard={onOpenCard} />
              </div>
              <div className="grid content-start gap-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Why these work together</h3>
                {t.interactions.map((i) => (
                  <div key={i.ruleId} className="parchment rounded-xl border border-gold/20 p-4">
                    <p className="flex items-center gap-2 font-display text-sm text-gold-strong">
                      <Link2 className="size-4" aria-hidden /> {i.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{i.explanation}</p>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}

function CardGroup({ label, hint, names, onOpenCard }: { label: string; hint: string; names: string[]; onOpenCard: (name: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {label} <span className="normal-case tracking-normal">· {hint}</span>
      </p>
      {names.length ? (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <button key={n} type="button" onClick={() => onOpenCard(n)} className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:border-gold/60 hover:text-gold-strong">
              {n}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">None yet.</p>
      )}
    </div>
  );
}
