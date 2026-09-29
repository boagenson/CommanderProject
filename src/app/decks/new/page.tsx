import type { Metadata } from "next";
import { NewDeckForm } from "@/components/decks/new-deck-form";
import { PageHeader } from "@/components/layout/app-shell";

export const metadata: Metadata = { title: "New Deck" };

export default function NewDeckPage() {
  return (
    <>
      <PageHeader
        eyebrow="Deck import"
        title="New Deck"
        description="Pick your commander, paste a decklist from any site, and Commander Workshop will look up every card on Scryfall."
      />
      <NewDeckForm />
    </>
  );
}
