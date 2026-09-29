"use client";

import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Card, Deck, DeckAnalysis, DeckCard, DeckSection } from "@/lib/types";
import { DECK_SECTIONS } from "@/lib/types";
import { primaryType } from "@/lib/cards/helpers";
import { addCard, dismissUnresolved, removeCard, setQuantity, toggleLock } from "@/lib/deck/operations";
import { commanderIdentity, isCommanderLegal, isWithinIdentity, quantityWarning } from "@/lib/rules/commander";
import { useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { CardSearchBox } from "@/components/mtg/card-search-box";
import { UnresolvedList } from "@/components/decks/unresolved-list";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/components/ui/utils";
import { CardRow, CardTile } from "./deck-cards";

interface Props {
  deck: Deck;
  analysis: DeckAnalysis;
  onOpenCard: (card: Card) => void;
}

/** Sectioned deck editor with list and visual views. */
export function DeckEditor({ deck, analysis, onOpenCard }: Props) {
  const edit = useDeckEditor(deck);
  const view = useDeckStore((s) => s.preferences.cardView);
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const showPrices = useDeckStore((s) => s.preferences.showPrices);
  const setPreferences = useDeckStore((s) => s.setPreferences);
  const [filter, setFilter] = useState("");

  const identity = useMemo(() => commanderIdentity(deck.commanders.map((c) => c.card)), [deck.commanders]);

  const problems = useMemo(() => {
    const map = new Map<string, string>();
    for (const dc of deck.cards) {
      const c = dc.card;
      if (!isCommanderLegal(c)) map.set(c.oracleId, `Not legal in Commander (${c.commanderLegality.replace("_", " ")}).`);
      else if (identity.length && !isWithinIdentity(c, identity)) map.set(c.oracleId, "Outside your commander's color identity.");
      else {
        const w = quantityWarning(c, dc.quantity);
        if (w) map.set(c.oracleId, w);
      }
    }
    return map;
  }, [deck.cards, identity]);

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const match = (dc: DeckCard) =>
      !q || dc.card.name.toLowerCase().includes(q) || dc.card.typeLine.toLowerCase().includes(q) || dc.card.oracleText.toLowerCase().includes(q);
    const groups = new Map<DeckSection | "Maybeboard", DeckCard[]>();
    const commanders = deck.commanders.map<DeckCard>((c) => ({ card: c.card, quantity: 1 })).filter(match);
    if (commanders.length) groups.set("Commander", commanders);
    for (const dc of deck.cards) {
      if (!match(dc)) continue;
      const key = dc.board === "maybe" ? "Maybeboard" : primaryType(dc.card);
      groups.set(key, [...(groups.get(key) ?? []), dc]);
    }
    const order = [...DECK_SECTIONS, "Maybeboard"] as const;
    return order
      .filter((s) => groups.has(s))
      .map((s) => {
        const cards = groups.get(s)!.slice().sort((a, b) => a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name));
        return { key: s, cards, count: cards.reduce((n, c) => n + c.quantity, 0) };
      });
  }, [deck, filter]);

  const handlers = {
    onOpen: onOpenCard,
    onToggleLock: (dc: DeckCard) => edit((d) => toggleLock(d, dc.card.oracleId)),
    onRemove: (dc: DeckCard) => {
      edit((d) => removeCard(d, dc.card.oracleId, dc.board ?? "main"));
      toast(`Removed ${dc.card.name}.`, "info", {
        label: "Undo",
        onClick: () => edit((d) => addCard(d, dc.card, dc.quantity, dc.board ?? "main")),
      });
    },
    onQuantity: (dc: DeckCard, q: number) => {
      const warning = quantityWarning(dc.card, q);
      if (warning && q > dc.quantity) toast(warning, "error");
      edit((d) => setQuantity(d, dc.card.oracleId, q));
    },
  };

  function add(card: Card) {
    if (identity.length && !isWithinIdentity(card, identity)) toast(`${card.name} is outside your commander's color identity.`, "error");
    else if (!isCommanderLegal(card)) toast(`${card.name} isn't legal in Commander.`, "error");
    const existing = deck.cards.find((d) => d.card.oracleId === card.oracleId && (d.board ?? "main") === "main");
    const warning = existing ? quantityWarning(card, existing.quantity + 1) : null;
    if (warning) toast(warning, "error");
    edit((d) => addCard(d, card));
    if (!warning) toast(`Added ${card.name}.`, "success");
  }

  return (
    <div className="grid gap-4">
      <Panel className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <CardSearchBox onSelect={add} placeholder="Add a card by name…" label="Add card to deck" />
        </div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="deck-filter" className="sr-only">
            Filter cards in this deck
          </label>
          <input
            id="deck-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter this deck…"
            className="h-10 w-full rounded-lg border border-line bg-bg-raised pl-9 pr-3 text-sm text-ink placeholder:text-muted/80 focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/25"
          />
        </div>
        <div className="inline-flex rounded-lg border border-line bg-bg-raised p-0.5" role="group" aria-label="View">
          {(["list", "visual"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setPreferences({ cardView: v })}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
                view === v ? "bg-panel-3 text-gold-strong" : "text-muted hover:text-ink",
              )}
            >
              {v === "list" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
              {v === "list" ? "List" : "Visual"}
            </button>
          ))}
        </div>
      </Panel>

      {deck.unresolved.length > 0 && (
        <UnresolvedList unresolved={deck.unresolved} onDismiss={(i) => edit((d) => dismissUnresolved(d, i))} />
      )}

      {sections.length === 0 ? (
        <Panel className="grid place-items-center gap-2 px-6 py-14 text-center">
          <Plus className="size-6 text-gold" aria-hidden />
          <p className="font-display text-ink">{filter ? "No cards match that filter." : "This deck is empty."}</p>
          {!filter && <p className="text-sm text-muted">Add cards with the search box above, from Card Search, or import a list.</p>}
        </Panel>
      ) : view === "list" ? (
        <div className="columns-1 gap-4 xl:columns-2 2xl:columns-3">
          {sections.map((s) => (
            <Panel key={s.key} className="mb-4 break-inside-avoid">
              <SectionHeading label={s.key} count={s.count} />
              <ul className="p-2">
                {s.cards.map((dc) => (
                  <CardRow
                    key={`${dc.card.oracleId}-${dc.board ?? "main"}`}
                    dc={dc}
                    isCommander={s.key === "Commander"}
                    categories={analysis.cardCategories[dc.card.name]?.categories ?? []}
                    currency={currency}
                    showPrices={showPrices}
                    problem={problems.get(dc.card.oracleId)}
                    {...handlers}
                  />
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {sections.map((s) => (
            <section key={s.key} aria-label={`${s.key} (${s.count})`}>
              <SectionHeading label={s.key} count={s.count} bare />
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-7">
                {s.cards.map((dc) => (
                  <CardTile
                    key={`${dc.card.oracleId}-${dc.board ?? "main"}`}
                    dc={dc}
                    isCommander={s.key === "Commander"}
                    categories={[]}
                    currency={currency}
                    showPrices={showPrices}
                    problem={problems.get(dc.card.oracleId)}
                    {...handlers}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const SECTION_LABELS: Partial<Record<string, string>> = {
  Creature: "Creatures",
  Artifact: "Artifacts",
  Enchantment: "Enchantments",
  Instant: "Instants",
  Sorcery: "Sorceries",
  Planeswalker: "Planeswalkers",
  Battle: "Battles",
  Land: "Lands",
};

function SectionHeading({ label, count, bare }: { label: string; count: number; bare?: boolean }) {
  return (
    <h3 className={cn("flex items-center justify-between font-display text-sm tracking-wide text-ink", bare ? "border-b border-line pb-2" : "border-b border-line/70 px-4 py-3")}>
      <span>{SECTION_LABELS[label] ?? label}</span>
      <span className="rounded-full bg-panel-3 px-2 py-0.5 font-sans text-xs tabular-nums text-ink-2">{count}</span>
    </h3>
  );
}
