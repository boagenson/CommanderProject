"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Deck } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { commanderIdentity, deckSize, COMMANDER_DECK_SIZE } from "@/lib/rules/commander";
import { expandDeck } from "@/lib/analysis/analyze";
import { averageManaValue, priceTotal } from "@/lib/analysis/stats";
import { useDeckStore } from "@/lib/state/deck-store";
import { CardArt } from "@/components/mtg/card-image";
import { ColorPips } from "@/components/mtg/mana";
import { Badge } from "@/components/ui/badge";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function DeckTile({ deck, index = 0 }: { deck: Deck; index?: number }) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const stats = useMemo(() => {
    const all = expandDeck(deck);
    return {
      size: deckSize(deck),
      avg: averageManaValue(all),
      price: priceTotal(all, currency),
      identity: commanderIdentity(deck.commanders.map((c) => c.card)),
    };
  }, [deck, currency]);
  const [first, second] = deck.commanders;

  return (
    <Link
      href={`/decks/${deck.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_10px_30px_#0006] transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[0_18px_40px_#000a,0_0_0_1px_#c9a25a33] animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative h-40 overflow-hidden">
        {second ? (
          <div className="grid h-full grid-cols-2">
            <CardArt card={first.card} className="size-full transition-transform duration-500 group-hover:scale-105" />
            <CardArt card={second.card} className="size-full border-l border-black/40 transition-transform duration-500 group-hover:scale-105" />
          </div>
        ) : (
          <CardArt card={first?.card} className="size-full transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-black/55 px-2 py-1 backdrop-blur">
            <ColorPips colors={stats.identity} size="sm" />
          </span>
        </div>
      </div>
      <div className="relative -mt-8 flex flex-1 flex-col gap-3 px-4 pb-4">
        <div>
          <h3 className="truncate font-display text-lg text-ink group-hover:text-gold-strong">{deck.name}</h3>
          <p className="truncate text-xs text-ink-2">
            {first ? first.card.name : "No commander yet"}
            {second && <span className="text-muted"> &amp; {second.card.name}</span>}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-bg-raised/80 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wider text-muted">Cards</dt>
            <dd className={`tabular-nums text-sm ${stats.size === COMMANDER_DECK_SIZE ? "text-ink" : "text-warn"}`}>
              {stats.size}/{COMMANDER_DECK_SIZE}
            </dd>
          </div>
          <div className="rounded-lg bg-bg-raised/80 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wider text-muted">Avg MV</dt>
            <dd className="tabular-nums text-sm text-ink">{stats.avg.toFixed(2)}</dd>
          </div>
          <div className="rounded-lg bg-bg-raised/80 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wider text-muted">Value</dt>
            <dd className="tabular-nums text-sm text-ink">{stats.price.priced ? formatPrice(stats.price.total, currency) : "—"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between text-[11px] text-muted">
          <span>Updated {dateFmt.format(deck.updatedAt)}</span>
          {deck.unresolved.length > 0 && <Badge tone="warn">{deck.unresolved.length} unresolved</Badge>}
        </div>
      </div>
    </Link>
  );
}
