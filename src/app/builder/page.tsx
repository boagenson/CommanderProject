"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hammer, Plus } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useDecks } from "@/lib/state/deck-store";

/** Opens the active (or most recent) deck in the builder. */
export default function BuilderPage() {
  const { decks, loaded, preferences } = useDecks();
  const router = useRouter();
  const target = decks.find((d) => d.id === preferences.activeDeckId) ?? decks[0];

  useEffect(() => {
    if (loaded && target) router.replace(`/decks/${target.id}`);
  }, [loaded, target, router]);

  if (!loaded || target) return <Skeleton className="h-64 rounded-2xl" />;
  return (
    <>
      <PageHeader title="Deck Builder" eyebrow="Build" />
      <EmptyState
        icon={<Hammer />}
        title="No deck to edit yet"
        action={
          <Button asChild variant="primary">
            <Link href="/decks/new">
              <Plus /> New Deck
            </Link>
          </Button>
        }
      >
        Create a deck or import a decklist to start building.
      </EmptyState>
    </>
  );
}
