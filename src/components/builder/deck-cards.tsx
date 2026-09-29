"use client";

import { Crown, Lock, LockOpen, Minus, Plus, Trash2 } from "lucide-react";
import type { Card, DeckCard, FunctionalCategory } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { copyLimit } from "@/lib/rules/commander";
import { CardImage } from "@/components/mtg/card-image";
import { ManaCost } from "@/components/mtg/mana";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

export interface RowHandlers {
  onOpen: (card: Card) => void;
  onToggleLock?: (dc: DeckCard) => void;
  onRemove?: (dc: DeckCard) => void;
  onQuantity?: (dc: DeckCard, q: number) => void;
}

interface RowProps extends RowHandlers {
  dc: DeckCard;
  categories: FunctionalCategory[];
  currency: "usd" | "eur" | "tix";
  showPrices: boolean;
  isCommander?: boolean;
  problem?: string;
}

/** Compact list row for one deck entry. */
export function CardRow({ dc, categories, currency, showPrices, isCommander, problem, onOpen, onToggleLock, onRemove, onQuantity }: RowProps) {
  const { card } = dc;
  const over = dc.quantity > copyLimit(card);
  return (
    <li
      className={cn(
        "group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-3/60 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto]",
        problem && "bg-danger/5",
      )}
    >
      <span className={cn("text-center text-sm tabular-nums", over ? "font-semibold text-danger" : "text-muted")}>
        {isCommander ? <Crown className="mx-auto size-4 text-gold" aria-label="Commander" /> : `${dc.quantity}×`}
      </span>
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(card)}
          className="flex w-full min-w-0 items-center gap-2 text-left text-sm text-ink hover:text-gold-strong focus-visible:text-gold-strong"
        >
          <span className="truncate">{card.name}</span>
          {dc.locked && <Lock className="size-3 shrink-0 text-gold" aria-label="Locked" />}
          {problem && (
            <Tooltip content={problem}>
              <span><Badge tone="danger">!</Badge></span>
            </Tooltip>
          )}
        </button>
        {categories.length > 0 && (
          <div className="mt-0.5 hidden flex-wrap gap-1 sm:flex">
            {categories.slice(0, 3).map((c) => (
              <span key={c} className="text-[10px] uppercase tracking-wide text-muted">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        <ManaCost cost={card.manaCost} className="text-sm" />
        {showPrices && <span className="w-14 text-right text-xs tabular-nums text-muted">{formatPrice(card.prices[currency], currency)}</span>}
      </div>
      <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-60 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {onQuantity && !isCommander && (
          <>
            <Tooltip content="Remove one">
              <button type="button" aria-label={`Decrease ${card.name}`} onClick={() => onQuantity(dc, dc.quantity - 1)} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-ink">
                <Minus className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Add one">
              <button type="button" aria-label={`Increase ${card.name}`} onClick={() => onQuantity(dc, dc.quantity + 1)} className="rounded p-1 text-muted hover:bg-panel-3 hover:text-ink">
                <Plus className="size-3.5" />
              </button>
            </Tooltip>
          </>
        )}
        {onToggleLock && !isCommander && (
          <Tooltip content={dc.locked ? "Locked: upgrades won't suggest cutting this" : "Lock: never suggest cutting this"}>
            <button
              type="button"
              aria-pressed={!!dc.locked}
              aria-label={`${dc.locked ? "Unlock" : "Lock"} ${card.name}`}
              onClick={() => onToggleLock(dc)}
              className={cn("rounded p-1 hover:bg-panel-3", dc.locked ? "text-gold-strong" : "text-muted hover:text-ink")}
            >
              {dc.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          </Tooltip>
        )}
        {onRemove && !isCommander && (
          <Tooltip content="Remove from deck">
            <button type="button" aria-label={`Remove ${card.name}`} onClick={() => onRemove(dc)} className="rounded p-1 text-muted hover:bg-danger/15 hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}

/** Visual card tile for the grid view. */
export function CardTile({ dc, isCommander, problem, onOpen, onToggleLock, onRemove }: RowProps) {
  const { card } = dc;
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(card)}
        className="block w-full rounded-[4.75%/3.5%] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_#000c] focus-visible:-translate-y-1"
        aria-label={`${card.name}${dc.quantity > 1 ? `, ${dc.quantity} copies` : ""}`}
      >
        <CardImage card={card} size="normal" className={cn(problem && "ring-2 ring-danger")} />
      </button>
      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        {isCommander && (
          <span className="rounded-full bg-black/70 p-1 text-gold-strong">
            <Crown className="size-3.5" aria-label="Commander" />
          </span>
        )}
        {dc.quantity > 1 && <span className="rounded-full bg-black/75 px-2 py-0.5 text-xs font-semibold text-ink">×{dc.quantity}</span>}
        {dc.locked && (
          <span className="rounded-full bg-black/70 p-1 text-gold-strong">
            <Lock className="size-3.5" aria-label="Locked" />
          </span>
        )}
      </div>
      {!isCommander && (onToggleLock || onRemove) && (
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {onToggleLock && (
            <button
              type="button"
              aria-pressed={!!dc.locked}
              aria-label={`${dc.locked ? "Unlock" : "Lock"} ${card.name}`}
              onClick={() => onToggleLock(dc)}
              className="rounded-full bg-black/75 p-1.5 text-ink hover:text-gold-strong"
            >
              {dc.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          )}
          {onRemove && (
            <button type="button" aria-label={`Remove ${card.name}`} onClick={() => onRemove(dc)} className="rounded-full bg-black/75 p-1.5 text-ink hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
