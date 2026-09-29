import type { Card, CategorizedCard, Deck, DeckAnalysis, FunctionalCategory } from "@/lib/types";
import { FUNCTIONAL_CATEGORIES } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { commanderIdentity, validateDeck } from "@/lib/rules/commander";
import { analyzeThemes } from "@/lib/synergy/engine";
import { classifyCard, effectiveCategories } from "./categories";
import { deckHealth } from "./health";
import { averageManaValue, colorCounts, manaCurve, manaProduction, priceTotal, typeCounts } from "./stats";

/** Main-deck cards with quantity expanded, plus commanders. */
export function expandDeck(deck: Pick<Deck, "cards" | "commanders">): Card[] {
  const out: Card[] = deck.commanders.map((c) => c.card);
  for (const dc of deck.cards) {
    if ((dc.board ?? "main") !== "main") continue;
    for (let i = 0; i < dc.quantity; i++) out.push(dc.card);
  }
  return out;
}

/**
 * Full deck analysis. Pure and synchronous: all card data is already on the
 * deck, so this runs in a few milliseconds and can be recomputed on every edit.
 */
export function analyzeDeck(deck: Deck, currency: "usd" | "eur" | "tix" = "usd"): DeckAnalysis {
  const commanders = deck.commanders.map((c) => c.card);
  const identity = commanderIdentity(commanders);
  const all = expandDeck(deck);
  const main = deck.cards.filter((c) => (c.board ?? "main") === "main");

  const categories = Object.fromEntries(FUNCTIONAL_CATEGORIES.map((c) => [c, [] as string[]])) as Record<
    FunctionalCategory,
    string[]
  >;
  const cardCategories: Record<string, CategorizedCard> = {};
  const entries = [
    ...deck.commanders,
    ...main,
  ];
  for (const dc of entries) {
    const cats = effectiveCategories(dc);
    const auto = new Set(classifyCard(dc.card).map((m) => m.category));
    cardCategories[dc.card.name] = {
      name: dc.card.name,
      categories: cats,
      manual: (dc.categoryOverrides?.add ?? []).filter((c) => !auto.has(c)),
    };
    for (const c of cats) categories[c].push(dc.card.name);
  }

  const landCount = all.filter(isLand).length;
  const validation = validateDeck(deck);
  const production = manaProduction(all, identity);
  const avg = averageManaValue(all);
  const { total, priced } = priceTotal(all, currency);

  return {
    totalCards: all.length,
    landCount,
    nonlandCount: all.length - landCount,
    averageManaValue: avg,
    manaCurve: manaCurve(all),
    typeCounts: typeCounts(all),
    colorCounts: colorCounts(all),
    manaProduction: production,
    categories,
    cardCategories,
    totalPrice: total,
    pricedCards: priced,
    validation,
    health: deckHealth({
      landCount,
      nonlandCount: all.length - landCount,
      averageManaValue: avg,
      manaProduction: production,
      categories,
      validation,
    }),
    themes: analyzeThemes({ commanders, cards: main.map((d) => d.card) }),
  };
}
