"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stethoscope, Plus } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useDecks } from "@/lib/state/deck-store";

/** Opens the active (or most recent) deck on its Deck Doctor tab. */
export default function DoctorPage() {
  const { decks, loaded, preferences } = useDecks();
  const router = useRouter();
  const target = decks.find((d) => d.id === preferences.activeDeckId) ?? decks[0];

  useEffect(() => {
    if (loaded && target) router.replace(`/decks/${target.id}#doctor`);
  }, [loaded, target, router]);

  if (!loaded || target) return <Skeleton className="h-64 rounded-2xl" />;
  return (
    <>
      <PageHeader title="Deck Doctor" eyebrow="Diagnose" />
      <EmptyState
        icon={<Stethoscope />}
        title="No deck to diagnose yet"
        action={
          <Button asChild variant="primary">
            <Link href="/decks/new">
              <Plus /> New Deck
            </Link>
          </Button>
        }
      >
        Create a deck or import a decklist, then open Deck Doctor for a full report.
      </EmptyState>
    </>
  );
}
