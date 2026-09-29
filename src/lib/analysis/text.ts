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

/**
 * Rules text limited to tokens the card itself makes for you. Drops sentences
 * where another player gets the tokens ("Its controller creates…"),
 * replacement or doubling effects ("would create", "twice that many") and
 * triggers on token creation ("Whenever you create or sacrifice a token").
 */
export function ownTokenText(text: string): string {
  return text
    .split(/(?<=[.\n])/)
    .filter(
      (s) =>
        !/would (?:create|be created)|twice that many|whenever you create|(?:its controller|its owner|that player|target opponent|each opponent|an opponent|that (?:creature|permanent)'s controller) creates?\b/.test(s),
    )
    .join("");
}

/**
 * Death triggers: "Whenever a creature you control dies", including the
 * self-referencing "Whenever ~ or another creature dies" (Blood Artist).
 */
export const DEATH_TRIGGER =
  /whenever (?:~ or )?(?:a|an|another|one or more)(?: other)?(?: nontoken)? creatures?(?: or planeswalkers?)?(?: you control)? (?:dies|die)/;
