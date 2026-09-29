import { normalizeCard } from "@/lib/scryfall/normalize";
import { parseDecklist } from "@/lib/deck/parser";
import { createDeck, importEntries } from "@/lib/deck/operations";
import { SAMPLE_DECKLIST } from "@/lib/deck/sample";
import type { Card, Deck } from "@/lib/types";
import { FIXTURE_BY_NAME } from "../fixtures/cards";

export function fixtureCard(name: string): Card {
  const raw = FIXTURE_BY_NAME.get(name.toLowerCase());
  if (!raw) throw new Error(`No fixture for ${name}`);
  return normalizeCard(raw);
}

/** Build a deck from decklist text using fixtures instead of Scryfall. */
export function deckFromText(text = SAMPLE_DECKLIST): Deck {
  const { entries } = parseDecklist(text);
  const resolved = entries
    .filter((e) => FIXTURE_BY_NAME.has(e.name.toLowerCase()))
    .map((entry) => ({ entry, card: fixtureCard(entry.name) }));
  const unresolved = entries
    .filter((e) => !FIXTURE_BY_NAME.has(e.name.toLowerCase()))
    .map((e) => ({ line: e.line, name: e.name, quantity: e.quantity, reason: "not in fixtures" }));
  return importEntries(createDeck("Test"), resolved, unresolved);
}
