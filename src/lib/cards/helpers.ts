import type { Card, CardType, Color, DeckSection } from "@/lib/types";

const TYPE_PRIORITY: CardType[] = [
  "Creature",
  "Planeswalker",
  "Battle",
  "Land",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
];

/** Type line of the front face (MDFCs like "Sorcery // Land" count as their front). */
export function frontTypeLine(card: Pick<Card, "typeLine">) {
  return card.typeLine.split(" // ")[0];
}

export function hasType(card: Pick<Card, "typeLine">, type: CardType) {
  return new RegExp(`\\b${type}\\b`).test(frontTypeLine(card));
}

/** Every card type on the front face. */
export function cardTypes(card: Pick<Card, "typeLine">): CardType[] {
  return TYPE_PRIORITY.filter((t) => hasType(card, t));
}

/** The single section a card is displayed under in the deck builder. */
export function primaryType(card: Pick<Card, "typeLine">): DeckSection {
  return TYPE_PRIORITY.find((t) => hasType(card, t)) ?? "Other";
}

export function isLand(card: Pick<Card, "typeLine">) {
  return hasType(card, "Land");
}

export function isBasicLand(card: Pick<Card, "typeLine">) {
  return /\bBasic\b/.test(card.typeLine) && /\bLand\b/.test(card.typeLine);
}

export function isLegendary(card: Pick<Card, "typeLine">) {
  return /\bLegendary\b/.test(frontTypeLine(card));
}

/** Creature subtypes, e.g. ["Halfling", "Scout"]. */
export function creatureSubtypes(card: Pick<Card, "typeLine">): string[] {
  const line = frontTypeLine(card);
  if (!/\bCreature\b|\bKindred\b|\bTribal\b/.test(line)) return [];
  const [, subtypes] = line.split(/\s+[—-]\s+/);
  return subtypes ? subtypes.split(/\s+/).filter(Boolean) : [];
}

export interface PipCount {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
  generic: number;
}

/**
 * Count mana symbols in a mana cost. Hybrid symbols ({W/U}) count half toward
 * each color; Phyrexian ({B/P}) counts as the color.
 */
export function countPips(manaCost: string): PipCount {
  const pips: PipCount = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, generic: 0 };
  // Only the front face's cost is paid when casting normally.
  const cost = manaCost.split(" // ")[0];
  for (const [, sym] of cost.matchAll(/\{([^}]+)\}/g)) {
    const parts = sym.split("/").filter((p) => p !== "P");
    const colors = parts.filter((p): p is Color | "C" => /^[WUBRGC]$/.test(p));
    if (/^\d+$/.test(sym)) pips.generic += Number(sym);
    else if (colors.length) for (const c of colors) pips[c] += 1 / colors.length;
  }
  return pips;
}

export function cardPrice(card: Pick<Card, "prices">, currency: "usd" | "eur" | "tix" = "usd") {
  return card.prices[currency];
}

export function formatPrice(value: number | undefined, currency: "usd" | "eur" | "tix" = "usd") {
  if (value == null) return "—";
  if (currency === "tix") return `${value.toFixed(2)} tix`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "eur" ? "EUR" : "USD",
  }).format(value);
}

export function colorIdentityKey(colors: Color[]) {
  const order = "WUBRG";
  return [...colors].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("");
}

export const COLOR_NAMES: Record<Color | "C", string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  C: "Colorless",
};

/** Best image for display, handling double-faced cards. */
export function cardImage(card: Card, size: "small" | "normal" | "large" | "artCrop" = "normal") {
  return card.images[size] ?? card.images.normal ?? card.faces?.[0]?.imageNormal;
}
