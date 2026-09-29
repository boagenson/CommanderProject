/** Pure deck statistics. Inputs are expanded card lists (quantity applied). */
import type { Card, CardType, Color, DeckAnalysis, ManaColor, ManaProduction } from "@/lib/types";
import { COLORS } from "@/lib/types";
import { cardTypes, countPips, hasType, isLand } from "@/lib/cards/helpers";

export const CURVE_BUCKETS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

export function manaCurve(cards: Card[]): DeckAnalysis["manaCurve"] {
  const rows = CURVE_BUCKETS.map((mv) => ({ mv, count: 0, creatures: 0, other: 0 }));
  for (const c of cards) {
    if (isLand(c)) continue;
    const i = Math.min(7, Math.max(0, Math.floor(c.cmc)));
    rows[i].count++;
    if (hasType(c, "Creature")) rows[i].creatures++;
    else rows[i].other++;
  }
  return rows;
}

export function averageManaValue(cards: Card[]) {
  const spells = cards.filter((c) => !isLand(c));
  if (!spells.length) return 0;
  return spells.reduce((n, c) => n + c.cmc, 0) / spells.length;
}

/** Counts every type on a card (an Artifact Creature counts for both). */
export function typeCounts(cards: Card[]): Record<CardType, number> {
  const out: Record<CardType, number> = {
    Creature: 0, Artifact: 0, Enchantment: 0, Instant: 0, Sorcery: 0, Planeswalker: 0, Battle: 0, Land: 0,
  };
  for (const c of cards) for (const t of cardTypes(c)) out[t]++;
  return out;
}

/** Card colors for nonland cards; multicolor cards count once per color and once as Multicolor. */
export function colorCounts(cards: Card[]): DeckAnalysis["colorCounts"] {
  const out = { W: 0, U: 0, B: 0, R: 0, G: 0, Colorless: 0, Multicolor: 0 };
  for (const c of cards) {
    if (isLand(c)) continue;
    if (!c.colors.length) out.Colorless++;
    for (const col of c.colors) out[col]++;
    if (c.colors.length > 1) out.Multicolor++;
  }
  return out;
}

const emptyMana = (): Record<ManaColor, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

/**
 * Mana production vs. requirements. Uses Scryfall's `produced_mana`, so fetch
 * lands and other indirect fixers are only counted when Scryfall lists them.
 * Lands that search for basics are credited with the deck's identity colors.
 */
export function manaProduction(cards: Card[], identity: Color[]): ManaProduction {
  const sources = emptyMana();
  const landSources = emptyMana();
  const pips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };

  for (const c of cards) {
    const land = isLand(c);
    let produced = c.producedMana;
    if (land && !produced.length && /search your library for [^.]*(?:basic )?land/i.test(c.oracleText)) {
      produced = identity; // fetch lands / Evolving Wilds
    }
    for (const m of new Set(produced)) {
      // A source only matters if the deck can use it.
      if (m !== "C" && !identity.includes(m)) continue;
      sources[m]++;
      if (land) landSources[m]++;
    }
    if (!land) {
      const p = countPips(c.manaCost);
      for (const col of COLORS) pips[col] += p[col];
    }
  }

  const totalPips = COLORS.reduce((n, c) => n + pips[c], 0);
  const totalSources = COLORS.reduce((n, c) => n + sources[c], 0);
  const mismatches = COLORS.filter((c) => identity.includes(c)).map((color) => ({
    color,
    pipShare: totalPips ? pips[color] / totalPips : 0,
    sourceShare: totalSources ? sources[color] / totalSources : 0,
  }));

  return { sources, landSources, pips, mismatches };
}

export function priceTotal(cards: Card[], currency: "usd" | "eur" | "tix" = "usd") {
  let total = 0;
  let priced = 0;
  for (const c of cards) {
    const p = c.prices[currency];
    if (p != null) {
      total += p;
      priced++;
    }
  }
  return { total, priced };
}
