"use client";

/**
 * "Why is this card here?" and "Test Cut" for one card in a deck. Everything
 * shown is derived from the current analysis (roles, tags, graph neighbours,
 * packages, combos); no per-card explanations are stored.
 */
import { CircleHelp, RotateCcw, Scissors } from "lucide-react";
import { useMemo, useState } from "react";
import type { Card, Deck, DeckAnalysis } from "@/lib/types";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { neighborsOf } from "@/lib/synergy/graph";
import { EDGE_KIND_LABELS } from "@/lib/synergy/graph";
import { removeCard } from "@/lib/deck/operations";
import { useDeckStore } from "@/lib/state/deck-store";
import { CompareTable } from "@/components/analysis/compare-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function buildWhyHere(card: Card, deck: Deck, analysis: DeckAnalysis) {
  const info = analysis.cardCategories[card.name];
  const roles = info?.roles ?? [];
  const tags = info?.tags ?? [];
  const node = analysis.graph.nodes.find((n) => n.name === card.name);
  const neighbors = node ? neighborsOf(analysis.graph, node.id).slice(0, 8) : [];
  const packages = analysis.packages.filter((p) => [...p.enablers, ...p.payoffs, ...p.support].includes(card.name));
  const combos = analysis.combos.filter((c) => c.type !== "near" && c.present.includes(card.name));
  const themeRoles = analysis.themes.flatMap((t) => t.cards.filter((c) => c.name === card.name).map((c) => ({ theme: t, role: c.role })));
  const isCommander = deck.commanders.some((c) => c.card.name === card.name);

  const bits: string[] = [];
  if (isCommander) bits.push("It is one of the deck's commanders, so every other card is chosen around it.");
  for (const tr of themeRoles.slice(0, 3)) {
    bits.push(
      tr.role === "payoff"
        ? `It rewards the ${tr.theme.name} theme, which ${tr.theme.cards.filter((c) => c.role !== "payoff").length} other cards feed.`
        : tr.role === "both"
          ? `It both produces and rewards ${tr.theme.name}.`
          : `It feeds the ${tr.theme.name} theme for ${tr.theme.cards.filter((c) => c.role !== "enabler").length} payoff card${tr.theme.cards.filter((c) => c.role !== "enabler").length === 1 ? "" : "s"}.`,
    );
  }
  const utility = roles.filter((r) => !["Enabler", "Payoff"].includes(r.value));
  if (utility.length) bits.push(`Functionally it provides ${utility.map((r) => r.value.toLowerCase()).join(", ")}${utility[0].reason ? ` (${utility[0].reason.toLowerCase()})` : ""}.`);
  for (const c of combos.slice(0, 2)) bits.push(`It is part of ${c.definition.name}: ${c.definition.result}`);
  if (neighbors.length) bits.push(`Its strongest link is ${neighbors[0].edge.label.toLowerCase()} with ${neighbors[0].other.name}.`);
  if (!bits.length) bits.push("Commander Workshop can't read a specific purpose from this card's text. It may be a standalone threat, a flavor pick, or filling a role the heuristics don't detect. You can add roles or tags manually above.");

  return { roles, tags, neighbors, packages, combos, themeRoles, explanation: bits.join(" ") };
}

export function WhyHere({ card, deck, analysis, onOpenCard }: { card: Card; deck: Deck; analysis: DeckAnalysis; onOpenCard?: (name: string) => void }) {
  const why = useMemo(() => buildWhyHere(card, deck, analysis), [card, deck, analysis]);
  return (
    <section className="grid gap-3 rounded-xl border border-gold/25 bg-gold-soft/20 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm text-gold-strong">
        <CircleHelp className="size-4" aria-hidden /> Why is this card here?
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Roles</p>
          <div className="flex flex-wrap gap-1">
            {why.roles.length ? why.roles.map((r) => (
              <Tooltip key={r.value} content={`${r.reason} · confidence ${Math.round(r.confidence * 100)}%${r.manual ? " · set by you" : ""}`}>
                <span><Badge tone={r.manual ? "gold" : "neutral"}>{r.value}</Badge></span>
              </Tooltip>
            )) : <span className="text-xs text-muted">None detected</span>}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Themes</p>
          <div className="flex flex-wrap gap-1">
            {why.tags.length ? why.tags.map((t) => (
              <Tooltip key={t.value} content={`${t.reason} · confidence ${Math.round(t.confidence * 100)}%`}>
                <span><Badge tone="info">{t.value}</Badge></span>
              </Tooltip>
            )) : <span className="text-xs text-muted">None detected</span>}
          </div>
        </div>
      </div>
      {why.neighbors.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Works especially well with</p>
          <ul className="flex flex-wrap gap-1">
            {why.neighbors.map(({ edge, other }) => (
              <li key={other.id}>
                <Tooltip content={`${edge.label} · ${EDGE_KIND_LABELS[edge.kind]}`}>
                  <button type="button" onClick={() => onOpenCard?.(other.name)} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-2 hover:border-gold/60 hover:text-gold-strong">
                    {other.name}
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      )}
      {why.packages.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Packages</p>
          <div className="flex flex-wrap gap-1">
            {why.packages.map((p) => (
              <Badge key={p.id} tone="gold">{p.name}</Badge>
            ))}
          </div>
        </div>
      )}
      <p className="text-[13px] leading-relaxed text-ink-2">{why.explanation}</p>
    </section>
  );
}

/** Temporarily remove the card and show the before/after deltas. Never saves. */
export function TestCut({ card, deck, analysis }: { card: Card; deck: Deck; analysis: DeckAnalysis }) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const [active, setActive] = useState(false);
  const inDeck = deck.cards.some((d) => d.card.oracleId === card.oracleId && (d.board ?? "main") === "main");
  const after = useMemo(() => (active ? analyzeDeck(removeCard(deck, card.oracleId), currency) : null), [active, deck, card.oracleId, currency]);
  if (!inDeck) return null;
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm text-ink">
          <Scissors className="size-4 text-gold" aria-hidden /> What happens if I cut this?
        </h3>
        {active ? (
          <Button size="sm" variant="outline" onClick={() => setActive(false)}>
            <RotateCcw /> Restore card
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setActive(true)}>
            <Scissors /> Test Cut
          </Button>
        )}
      </div>
      {active && after ? (
        <>
          <p className="text-xs text-muted">Removing {card.name} changes the following. Your saved deck has not been modified.</p>
          <CompareTable before={analysis} after={after} labels={["With", "Without"]} />
        </>
      ) : (
        <p className="text-xs text-muted">Recalculates roles, themes, mana, packages and win conditions without this card. Nothing is saved.</p>
      )}
    </section>
  );
}
