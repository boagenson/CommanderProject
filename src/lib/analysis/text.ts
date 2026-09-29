import type { Card } from "@/lib/types";

const cache = new WeakMap<Card, string>();

/**
 * Oracle text prepared for heuristics: lowercased, reminder text removed and
 * the card's own name replaced by "~" (so "Sam deals 2 damage" reads "~ deals").
 * Memoized per card object.
 */
export function rulesText(card: Card): string {
  const hit = cache.get(card);
  if (hit !== undefined) return hit;
  let text = card.oracleText.replace(/\([^)]*\)/g, "");
  const names = card.name.split(" // ");
  for (const n of names) {
    text = text.split(n).join("~");
    const short = n.split(",")[0];
    if (short.length > 3 && short !== n) text = text.split(short).join("~");
  }
  text = text.replace(/this (creature|artifact|enchantment|permanent|land|spell|token)/gi, "~");
  const out = text.toLowerCase();
  cache.set(card, out);
  return out;
}

export function hasKeyword(card: Card, keyword: string) {
  const k = keyword.toLowerCase();
  return card.keywords.some((kw) => kw.toLowerCase() === k);
}
