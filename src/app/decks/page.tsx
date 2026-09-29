"use client";

import Link from "next/link";
import { Copy, Library, Plus, Trash2 } from "lucide-react";
import type { Deck } from "@/lib/types";
import { exportDecklist, newId } from "@/lib/deck/operations";
import { commanderIdentity, deckSize, COMMANDER_DECK_SIZE } from "@/lib/rules/commander";
import { useDecks, useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { PageHeader } from "@/components/layout/app-shell";
import { CardArt } from "@/components/mtg/card-image";
import { ColorPips } from "@/components/mtg/mana";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function DecksPage() {
  const { decks, loaded } = useDecks();
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);

  async function duplicate(deck: Deck) {
    const now = Date.now();
    await saveDeck({ ...structuredClone(deck), id: newId(), name: `${deck.name} (copy)`, createdAt: now, updatedAt: now });
    toast(`Duplicated "${deck.name}".`, "success");
  }

  async function remove(deck: Deck) {
    await deleteDeck(deck.id);
    toast(`Deleted "${deck.name}".`, "info", { label: "Undo", onClick: () => void saveDeck(deck) });
  }

  async function copy(deck: Deck) {
    try {
      await navigator.clipboard.writeText(exportDecklist(deck));
      toast("Decklist copied to clipboard.", "success");
    } catch {
      toast("Couldn't access the clipboard.", "error");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Decks"
        description="Every deck saved in this browser."
        actions={
          <Button asChild variant="primary">
            <Link href="/decks/new">
              <Plus /> New Deck
            </Link>
          </Button>
        }
      />
      {!loaded ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !decks.length ? (
        <EmptyState icon={<Library />} title="No saved decks">
          Create a deck or import a list to get started.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {decks.map((deck) => {
            const size = deckSize(deck);
            return (
              <li key={deck.id} className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel pr-3 transition-colors hover:border-gold/40">
                <CardArt card={deck.commanders[0]?.card} className="h-20 w-28 shrink-0 sm:w-36" alt="" />
                <div className="min-w-0 flex-1 py-2">
                  <Link href={`/decks/${deck.id}`} className="block truncate font-display text-base text-ink hover:text-gold-strong">
                    {deck.name}
                  </Link>
                  <p className="truncate text-xs text-ink-2">{deck.commanders.map((c) => c.card.name).join(" & ") || "No commander"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <ColorPips colors={commanderIdentity(deck.commanders.map((c) => c.card))} size="sm" />
                    <Badge tone={size === COMMANDER_DECK_SIZE ? "neutral" : "warn"}>{size} cards</Badge>
                    <span className="hidden sm:inline">Updated {dateFmt.format(deck.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Tooltip content="Copy decklist">
                    <Button size="icon" variant="ghost" aria-label={`Copy ${deck.name} decklist`} onClick={() => copy(deck)}>
                      <Copy />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Duplicate">
                    <Button size="icon" variant="ghost" aria-label={`Duplicate ${deck.name}`} onClick={() => duplicate(deck)}>
                      <Library />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete">
                    <Button size="icon" variant="ghost" aria-label={`Delete ${deck.name}`} onClick={() => remove(deck)} className="hover:text-danger">
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
