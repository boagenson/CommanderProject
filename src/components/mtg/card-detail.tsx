"use client";

import { ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import type { Card, Color, Deck, DeckAnalysis, DeckCard, FunctionalCategory, ProtectionLevel, ThematicTag } from "@/lib/types";
import { FUNCTIONAL_CATEGORIES, THEMATIC_TAGS } from "@/lib/types";
import { classifyCard } from "@/lib/analysis/categories";
import { classifyTags } from "@/lib/analysis/tags";
import { formatPrice } from "@/lib/cards/helpers";
import { isWithinIdentity, quantityWarning } from "@/lib/rules/commander";
import { cardThemeRoles } from "@/lib/synergy/engine";
import { THEME_BY_ID } from "@/lib/synergy/themes";
import { useDeckStore } from "@/lib/state/deck-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { CardImage } from "./card-image";
import { TestCut, WhyHere } from "./card-explainer";
import { ProtectionToggles } from "./protection";
import { ColorPips, ManaCost } from "./mana";
import { OracleText } from "./oracle-text";

export interface CardDeckActions {
  deckCard?: DeckCard;
  isCommander?: boolean;
  identity?: Color[];
  /** Kept for callers that only know about locking; prefer onProtection. */
  onToggleLock?: () => void;
  onProtection?: (level: ProtectionLevel, on: boolean) => void;
  onTag?: (tag: ThematicTag, state: "auto" | "on" | "off") => void;
  onRemove?: () => void;
  onQuantity?: (q: number) => void;
  onCategory?: (category: FunctionalCategory, state: "auto" | "on" | "off") => void;
  onAdd?: () => void;
  /** When both are given, the dialog shows "Why is this card here?" and "Test Cut". */
  deck?: Deck;
  analysis?: DeckAnalysis;
  onOpenCard?: (name: string) => void;
}

export function CardDetailDialog({
  card,
  open,
  onOpenChange,
  actions,
}: {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: CardDeckActions;
}) {
  if (!card) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" title={card.name} description={card.typeLine}>
        <CardDetailBody card={card} actions={actions} />
      </DialogContent>
    </Dialog>
  );
}

const legalityTone = { legal: "ok", banned: "danger", not_legal: "danger", restricted: "warn" } as const;

function CardDetailBody({ card, actions }: { card: Card; actions?: CardDeckActions }) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const matches = classifyCard(card);
  const dc = actions?.deckCard;
  const auto = new Set(matches.map((m) => m.category));
  const added = new Set(dc?.categoryOverrides?.add ?? []);
  const removed = new Set(dc?.categoryOverrides?.remove ?? []);
  const roles = cardThemeRoles(card);
  const tagMatches = classifyTags(card);
  const autoTags = new Set(tagMatches.map((m) => m.value));
  const addedTags = new Set(dc?.tagOverrides?.add ?? []);
  const removedTags = new Set(dc?.tagOverrides?.remove ?? []);
  const outside = actions?.identity && actions.identity.length > 0 && !isWithinIdentity(card, actions.identity);
  const qtyWarning = dc ? quantityWarning(card, dc.quantity) : null;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_1fr]">
        <div className="mx-auto w-full max-w-[240px]">
          <CardImage card={card} size="normal" priority />
          {card.faces && card.faces.length > 1 && card.faces[1].imageNormal && (
            <p className="mt-2 text-center text-xs text-muted">Double-faced card: {card.faces.map((f) => f.name).join(" // ")}</p>
          )}
        </div>
        <div className="grid content-start gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ManaCost cost={card.manaCost} className="text-lg" />
            <span className="text-muted">MV {card.cmc}</span>
          </div>
          <p className="text-ink-2">{card.typeLine}</p>
          <OracleText text={card.oracleText} className="rounded-xl border border-line bg-bg-raised p-3 text-[13px] leading-relaxed text-ink" />
          {(card.power || card.loyalty) && (
            <p className="font-display text-ink">
              {card.power != null ? `${card.power}/${card.toughness}` : `Loyalty ${card.loyalty}`}
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Color identity</dt>
            <dd><ColorPips colors={card.colorIdentity} size="sm" /></dd>
            <dt className="text-muted">Commander</dt>
            <dd>
              <Badge tone={legalityTone[card.commanderLegality]}>{card.commanderLegality.replace("_", " ")}</Badge>
            </dd>
            <dt className="text-muted">Set</dt>
            <dd className="text-ink-2">{card.setName} ({card.set.toUpperCase()}) #{card.collectorNumber}</dd>
            <dt className="text-muted">Rarity</dt>
            <dd className="capitalize text-ink-2">{card.rarity}</dd>
            <dt className="text-muted">Price</dt>
            <dd className="text-ink-2">{formatPrice(card.prices[currency], currency)}</dd>
          </dl>
          <a href={card.scryfallUri} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-gold-strong hover:underline">
            View on Scryfall <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>

      {outside && <Callout tone="error" title="Outside color identity">This card&apos;s color identity doesn&apos;t fit your commander.</Callout>}
      {qtyWarning && <Callout tone="warning">{qtyWarning}</Callout>}

      {actions && (dc ? actions.onQuantity || actions.onToggleLock || actions.onProtection || actions.onRemove : actions.onAdd) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg-raised p-3">
          {dc && actions.onQuantity && (
            <div className="flex items-center gap-1" role="group" aria-label="Quantity">
              <Button size="icon-sm" variant="ghost" aria-label="Decrease quantity" onClick={() => actions.onQuantity!(dc.quantity - 1)}>
                <Minus />
              </Button>
              <span className="w-6 text-center tabular-nums">{dc.quantity}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Increase quantity" onClick={() => actions.onQuantity!(dc.quantity + 1)}>
                <Plus />
              </Button>
            </div>
          )}
          {dc && !actions.isCommander && actions.onProtection && <ProtectionToggles dc={dc} onChange={actions.onProtection} />}
          {dc && !actions.isCommander && !actions.onProtection && actions.onToggleLock && (
            <ProtectionToggles dc={dc} onChange={(level, on) => level === "locked" && on !== !!dc.locked && actions.onToggleLock!()} />
          )}
          {dc && actions.onRemove && (
            <Button size="sm" variant="danger" onClick={actions.onRemove}>
              <Trash2 /> Remove
            </Button>
          )}
          {!dc && actions.onAdd && (
            <Button size="sm" variant="primary" onClick={actions.onAdd}>
              <Plus /> Add to deck
            </Button>
          )}
        </div>
      )}
      {dc && (dc.locked || dc.favorite || dc.flavorEssential) && (
        <p className="-mt-3 text-[11px] text-muted">
          {dc.locked && "Locked: upgrades will never suggest cutting this card. "}
          {dc.favorite && !dc.locked && "Favorite: only cut when the improvement is clear. "}
          {dc.flavorEssential && "Flavor Essential: theme fit counts extra when weighing this card."}
        </p>
      )}

      {actions?.deck && actions.analysis && (dc || actions.isCommander) && (
        <>
          <WhyHere card={card} deck={actions.deck} analysis={actions.analysis} onOpenCard={actions.onOpenCard} />
          {!actions.isCommander && <TestCut card={card} deck={actions.deck} analysis={actions.analysis} />}
        </>
      )}

      <section>
        <h3 className="mb-2 font-display text-sm text-ink">Functional categories</h3>
        {dc && actions?.onCategory ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {FUNCTIONAL_CATEGORIES.map((cat) => {
              const state: "auto" | "on" | "off" = added.has(cat) ? "on" : removed.has(cat) ? "off" : "auto";
              const active = state === "on" || (state === "auto" && auto.has(cat));
              const reason = matches.find((m) => m.category === cat)?.reason;
              return (
                <Tooltip key={cat} content={state === "auto" ? (reason ? `Detected: ${reason}. Click to remove.` : `Click to mark this card as ${cat}.`) : "Set manually. Click to restore automatic detection."}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => actions.onCategory!(cat, nextState(state, auto.has(cat)))}
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      active ? "border-gold/60 bg-gold-soft text-gold-strong" : "border-line text-muted hover:border-line-strong hover:text-ink-2"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{state === "auto" ? (auto.has(cat) ? "auto" : "") : "manual"}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ) : matches.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <li key={m.category}>
                <Tooltip content={m.reason}>
                  <span><Badge tone="gold">{m.category}</Badge></span>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No categories detected.</p>
        )}
        {dc && <p className="mt-2 text-[11px] text-muted">Categories are detected from rules text. Click one to correct it for this deck.</p>}
      </section>

      <section>
        <h3 className="mb-2 font-display text-sm text-ink">Thematic tags</h3>
        {dc && actions?.onTag ? (
          <div className="flex flex-wrap gap-1.5">
            {THEMATIC_TAGS.map((tag) => {
              const state: "auto" | "on" | "off" = addedTags.has(tag) ? "on" : removedTags.has(tag) ? "off" : "auto";
              const active = state === "on" || (state === "auto" && autoTags.has(tag));
              const match = tagMatches.find((m) => m.value === tag);
              return (
                <Tooltip key={tag} content={state === "auto" ? (match ? `Detected: ${match.reason} (${Math.round(match.confidence * 100)}%). Click to remove.` : `Click to tag this card as ${tag}.`) : "Set manually. Click to restore automatic detection."}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => actions.onTag!(tag, nextState(state, autoTags.has(tag)))}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active ? "border-info/60 bg-info/10 text-info" : "border-line text-muted hover:border-line-strong hover:text-ink-2"
                    }`}
                  >
                    {tag}
                    {state !== "auto" && <span className="ml-1 text-[10px] uppercase opacity-80">manual</span>}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        ) : tagMatches.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {tagMatches.map((m) => (
              <li key={m.value}>
                <Tooltip content={`${m.reason} (${Math.round(m.confidence * 100)}%)`}>
                  <span><Badge tone="info">{m.value}</Badge></span>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No thematic tags detected.</p>
        )}
      </section>

      {roles.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-sm text-ink">Theme roles</h3>
          <ul className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <li key={r.themeId}>
                <Badge tone="info">
                  {THEME_BY_ID[r.themeId]?.name}: {r.role === "both" ? "enabler + payoff" : r.role}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Toggle against the detected state: overriding once, clicking again restores auto. */
function nextState(state: "auto" | "on" | "off", detected: boolean): "auto" | "on" | "off" {
  if (state === "auto") return detected ? "off" : "on";
  return "auto";
}
