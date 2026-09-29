"use client";

import Link from "next/link";
import { BookOpen, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { DeckTile } from "@/components/decks/deck-tile";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useDecks } from "@/lib/state/deck-store";
import { useSampleDeck } from "@/lib/state/use-sample-deck";

export default function DashboardPage() {
  const { decks, loaded } = useDecks();
  const sample = useSampleDeck();

  return (
    <>
      <PageHeader
        eyebrow="Your command zone"
        title="Dashboard"
        description="Your saved Commander decks. Open one to edit it, analyze it, or plan upgrades."
        actions={
          <>
            <Button variant="ghost" onClick={sample.create} disabled={sample.loading}>
              {sample.loading ? <LoaderCircle className="animate-spin" /> : <BookOpen />}
              Load sample deck
            </Button>
            <Button asChild variant="primary" size="lg">
              <Link href="/decks/new">
                <Plus /> New Deck
              </Link>
            </Button>
          </>
        }
      />

      {!loaded ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="No decks yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="primary">
                <Link href="/decks/new">
                  <Plus /> Create a deck
                </Link>
              </Button>
              <Button variant="secondary" onClick={sample.create} disabled={sample.loading}>
                {sample.loading ? <LoaderCircle className="animate-spin" /> : <BookOpen />}
                Try the Frodo &amp; Sam sample
              </Button>
            </div>
          }
        >
          Paste a decklist from any site, or start from the sample Frodo &amp; Sam deck to see analysis and upgrade suggestions.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Saved decks">
          {decks.map((deck, i) => (
            <li key={deck.id}>
              <DeckTile deck={deck} index={i} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
