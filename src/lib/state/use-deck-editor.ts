"use client";

import { useCallback } from "react";
import type { Deck } from "@/lib/types";
import { useDeckStore } from "./deck-store";

/** Apply an immutable deck operation and persist it. */
export function useDeckEditor(deck: Deck | undefined) {
  const saveDeck = useDeckStore((s) => s.saveDeck);
  return useCallback(
    (op: (d: Deck) => Deck) => {
      if (!deck) return;
      const current = useDeckStore.getState().decks.find((d) => d.id === deck.id) ?? deck;
      const next = op(current);
      if (next !== current) void saveDeck(next).catch(() => undefined);
    },
    [deck, saveDeck],
  );
}
