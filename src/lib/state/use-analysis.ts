"use client";

import { useMemo } from "react";
import type { Deck } from "@/lib/types";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { useDeckStore } from "./deck-store";

/** Memoized analysis: recomputed only when the deck object changes. */
export function useAnalysis(deck: Deck | undefined) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  return useMemo(() => (deck ? analyzeDeck(deck, currency) : undefined), [deck, currency]);
}
