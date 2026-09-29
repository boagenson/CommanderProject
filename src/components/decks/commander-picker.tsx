"use client";

import { Crown, LoaderCircle, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Card } from "@/lib/types";
import { canBeCommander, canPairCommanders, pairingAbilities } from "@/lib/rules/commander";
import { describeScryfallError, getCardByName } from "@/lib/scryfall";
import { CardSearchBox } from "@/components/mtg/card-search-box";
import { CardArt } from "@/components/mtg/card-image";
import { ColorPips, ManaCost } from "@/components/mtg/mana";
import { Button } from "@/components/ui/button";

function pairingHint(card: Card) {
  const p = pairingAbilities(card);
  const withName = p.find((x) => x.kind === "partnerWith");
  if (withName && withName.kind === "partnerWith") return { label: `Partner with ${withName.name}`, name: withName.name };
  if (p.some((x) => x.kind === "chooseBackground")) return { label: "Can add a Background" };
  if (p.some((x) => x.kind === "partner")) return { label: "Has Partner" };
  if (p.some((x) => x.kind === "friendsForever")) return { label: "Has Friends forever" };
  if (p.some((x) => x.kind === "doctorsCompanion")) return { label: "Can add a Time Lord Doctor" };
  if (p.some((x) => x.kind === "timeLordDoctor")) return { label: "Can add a Doctor's companion" };
  return null;
}

/** Choose one commander, plus a second when a pairing ability allows it. */
export function CommanderPicker({ value, onChange }: { value: Card[]; onChange: (cards: Card[]) => void }) {
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first, second] = value;
  const hint = first ? pairingHint(first) : null;

  async function addNamedPartner(name: string) {
    setLoadingPartner(true);
    setError(null);
    try {
      const card = await getCardByName(name);
      onChange([first, card]);
    } catch (err) {
      setError(describeScryfallError(err));
    } finally {
      setLoadingPartner(false);
    }
  }

  return (
    <div className="grid gap-3">
      {value.map((card, i) => (
        <div key={card.id} className="flex items-center gap-3 overflow-hidden rounded-xl border border-gold/30 bg-bg-raised pr-2">
          <CardArt card={card} className="h-16 w-24 shrink-0" />
          <div className="min-w-0 flex-1 py-2">
            <p className="flex items-center gap-1.5 truncate font-display text-sm text-ink">
              <Crown className="size-3.5 shrink-0 text-gold" aria-hidden />
              {card.name}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted">
              <ManaCost cost={card.manaCost} />
              <ColorPips colors={card.colorIdentity} size="sm" />
            </p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${card.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}

      {!first && (
        <CardSearchBox
          label="Commander"
          placeholder="Search for your commander…"
          onSelect={(c) => onChange([c])}
          validate={(c) => (canBeCommander(c) ? null : `${c.name} can't be a commander. Pick a legendary creature or a card that says it can be your commander.`)}
        />
      )}

      {first && !second && hint && (
        <div className="grid gap-2 rounded-xl border border-dashed border-line-strong p-3">
          <p className="text-xs text-ink-2">
            {first.name}: <span className="text-gold-strong">{hint.label}</span>
          </p>
          {hint.name ? (
            <Button size="sm" variant="outline" className="w-fit" disabled={loadingPartner} onClick={() => addNamedPartner(hint.name!)}>
              {loadingPartner ? <LoaderCircle className="animate-spin" /> : <Plus />} Add {hint.name}
            </Button>
          ) : (
            <CardSearchBox
              label="Second commander"
              placeholder="Add a partner or background…"
              onSelect={(c) => onChange([first, c])}
              validate={(c) => (canPairCommanders(first, c) ? null : `${c.name} can't be paired with ${first.name}.`)}
            />
          )}
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
