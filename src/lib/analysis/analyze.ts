import type { Card, CategorizedCard, Classification, Deck, DeckAnalysis, FunctionalCategory, ThematicTag } from "@/lib/types";
import { FUNCTIONAL_CATEGORIES } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { commanderIdentity, validateDeck } from "@/lib/rules/commander";
import { analyzeThemes } from "@/lib/synergy/engine";
import { buildSynergyGraph } from "@/lib/synergy/graph";
import { detectPackages } from "@/lib/synergy/packages";
import { findCombos } from "@/lib/combo/engine";
import { effectiveRoles } from "./categories";
import { effectiveTags } from "./tags";
import { deckHealth } from "./health";
import { analyzeMana } from "./mana";
import { averageManaValue, colorCounts, manaCurve, manaProduction, priceTotal, typeCounts } from "./stats";
import { analyzeWinConditions } from "./wincons";

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
 * Each section is produced by its own module (stats, mana, categories, tags,
 * themes, combos, win conditions, graph, packages); this function only wires
 * them together.
 */
export function analyzeDeck(deck: Deck, currency: "usd" | "eur" | "tix" = "usd"): DeckAnalysis {
  const commanders = deck.commanders.map((c) => c.card);
  const identity = commanderIdentity(commanders);
  const all = expandDeck(deck);
  const main = deck.cards.filter((c) => (c.board ?? "main") === "main");

  const categories = Object.fromEntries(FUNCTIONAL_CATEGORIES.map((c) => [c, [] as string[]])) as Record<FunctionalCategory, string[]>;
  const cardCategories: Record<string, CategorizedCard> = {};
  const roleMap = new Map<string, Classification<FunctionalCategory>[]>();
  const tagMap = new Map<string, Classification<ThematicTag>[]>();
  for (const dc of [...deck.commanders, ...main]) {
    const roles = effectiveRoles(dc);
    const tags = effectiveTags(dc);
    cardCategories[dc.card.name] = {
      name: dc.card.name,
      categories: roles.map((r) => r.value),
      manual: roles.filter((r) => r.manual).map((r) => r.value),
      roles,
      tags,
    };
    roleMap.set(dc.card.name, roles);
    tagMap.set(dc.card.name, tags);
    for (const r of roles) categories[r.value].push(dc.card.name);
  }

  const landCount = all.filter(isLand).length;
  const validation = validateDeck(deck);
  const production = manaProduction(all, identity);
  const mana = analyzeMana(all, identity);
  const avg = averageManaValue(all);
  const { total, priced } = priceTotal(all, currency);
  const mainCards = main.map((d) => d.card);
  const themes = analyzeThemes({ commanders, cards: mainCards });
  const combos = findCombos(all.map((c) => c.name), { includeNear: true });
  const presentCombos = combos.filter((c) => c.type !== "near");
  const winConditions = analyzeWinConditions({ commanders, cards: mainCards, roles: roleMap, tags: tagMap, themes, combos: presentCombos, overrides: deck.winConditionOverrides });
  const graph = buildSynergyGraph({ commanders, cards: mainCards, themes, combos: presentCombos, roles: new Map([...roleMap].map(([k, v]) => [k, v.map((r) => r.value)])) });
  const packages = detectPackages(themes, tagMap, presentCombos);

  return {
    totalCards: all.length,
    landCount,
    nonlandCount: all.length - landCount,
    averageManaValue: avg,
    manaCurve: manaCurve(all),
    typeCounts: typeCounts(all),
    colorCounts: colorCounts(all),
    manaProduction: production,
    mana,
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
    themes,
    combos,
    winConditions,
    graph,
    packages,
  };
}
