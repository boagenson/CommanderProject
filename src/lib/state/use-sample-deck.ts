"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importDecklist } from "@/lib/deck/import";
import { SAMPLE_DECKLIST, SAMPLE_DECK_NAME } from "@/lib/deck/sample";
import { describeScryfallError } from "@/lib/scryfall";
import { useDeckStore } from "./deck-store";
import { toast } from "./toast-store";

/** Build the Frodo & Sam sample deck from live Scryfall data and open it. */
export function useSampleDeck() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const setPreferences = useDeckStore((s) => s.setPreferences);

  async function create() {
    setLoading(true);
    try {
      const { deck } = await importDecklist(SAMPLE_DECKLIST, { name: SAMPLE_DECK_NAME });
      await saveDeck(deck);
      await setPreferences({ activeDeckId: deck.id });
      toast(`Created "${deck.name}".`, "success");
      router.push(`/decks/${deck.id}`);
    } catch (err) {
      toast(describeScryfallError(err), "error");
    } finally {
      setLoading(false);
    }
  }
  return { create, loading };
}
