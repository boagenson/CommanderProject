/**
 * Functional categorization heuristics.
 *
 * Each rule inspects oracle text, types and keywords rather than card names,
 * so new cards are categorized without code changes. Add a rule by appending
 * to `CATEGORY_RULES`. Rules return a short reason shown to the user, which
 * also makes misclassifications easy to spot and correct manually.
 */
import type { Card, DeckCard, FunctionalCategory } from "@/lib/types";
import { hasType, isLand } from "@/lib/cards/helpers";
import { hasKeyword, ownTokenText, rulesText } from "./text";

export interface CategoryRule {
  category: FunctionalCategory;
  /** Return a reason string when the card matches, else null. */
  test: (card: Card, text: string) => string | null;
}

const first = (text: string, patterns: [RegExp, string][]) => {
  for (const [re, reason] of patterns) if (re.test(text)) return reason;
  return null;
};

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Ramp",
    test: (card, t) => {
      if (isLand(card)) return null;
      return first(t, [
        [/search your library for [^.]*\b(?:lands?|forest|plains|island|swamp|mountain)\b[^.]*cards?[^.]*onto the battlefield/, "Puts lands onto the battlefield"],
        [/put (?:a|up to \w+) land cards? from your hand onto the battlefield/, "Cheats lands into play"],
        [/you may play (?:an )?additional lands?/, "Extra land drops"],
        [/\badd (?:\{[wubrgc]\}|one mana|two mana|three mana|x mana|mana|an amount of)/, "Produces mana"],
        [/create (?:a|one|two|three|x|that many) (?:tapped )?treasure tokens?/, "Makes Treasure"],
        [/(?:spells|creature spells) you cast cost \{\d\} less/, "Cost reduction"],
      ]);
    },
  },
  {
    category: "Card Draw",
    test: (_card, t) =>
      first(t, [
        [/(?<!opponent |each player |target player |target opponent |that player )draws? (?:a|an additional|two|three|four|five|x|that many|cards equal)[^.]*cards?/, "Draws cards"],
        [/\binvestigate\b|create (?:a|one|two|x) clue tokens?/, "Makes Clues"],
        [/exile the top [^.]*of your library[^.]*you may (?:play|cast)/, "Impulse draw"],
        [/look at the top [^.]*put [^.]*into your hand/, "Card selection into hand"],
      ]),
  },
  {
    category: "Targeted Removal",
    test: (_card, t) => {
      const cleaned = t.replace(/target [^.,]*you control/g, "");
      return first(cleaned, [
        [/(?:destroy|exile) target (?!card)[^.]*(?:creature|permanent|artifact|enchantment|planeswalker|land|battle)/, "Destroys or exiles a target"],
        [/deals? (?:\d+|x) damage to (?:any target|target creature|target planeswalker|target attacking)/, "Damage-based removal"],
        [/target (?:creature|permanent)[^.]* gets? -\d+\/-\d+|target creature gets -x\/-x/, "Shrinks a target"],
        [/return target (?:nonland )?(?:creature|permanent|artifact|enchantment)[^.]* to (?:its|their) owner'?s? hand/, "Bounces a target"],
        [/target (?:player|opponent) sacrifices/, "Edict"],
        [/fights? (?:target|up to one target|another target)/, "Fight removal"],
      ]);
    },
  },
  {
    category: "Board Wipes",
    test: (_card, t) =>
      first(t, [
        [/(?:destroy|exile) all (?:other )?(?:creatures|nonland permanents|permanents|artifacts|enchantments|nontoken)/, "Mass destroy/exile"],
        [/(?:destroy|exile) each (?:other )?(?:creature|nonland permanent)/, "Mass destroy/exile"],
        [/(?:all|each) (?:other )?creatures? gets? -\d+\/-\d+|all creatures get -x\/-x/, "Mass shrink"],
        [/deals? (?:\d+|x) damage to each (?:other )?creature/, "Mass damage"],
        [/return all (?:nonland )?(?:permanents|creatures) to their owners'? hands/, "Mass bounce"],
        [/each player sacrifices (?:all|x|two|three)/, "Mass sacrifice"],
      ]),
  },
  {
    category: "Protection",
    test: (_card, t) =>
      first(t, [
        [/(?:creatures|permanents|artifacts|you and permanents) you control (?:gain|have|get)[^.]*(?:hexproof|indestructible|shroud|protection)/, "Protects your board"],
        [/target (?:creature|permanent|artifact)[^.]* you control gains? [^.]*(?:hexproof|indestructible|shroud|protection)/, "Protects a permanent"],
        [/(?:equipped|enchanted) creature (?:has|gains|gets)[^.]*(?:hexproof|indestructible|shroud|protection)/, "Protective Equipment/Aura"],
        [/phase out/, "Phasing protection"],
        [/you have hexproof|you (?:gain|have) protection from/, "Protects you"],
        [/(?:damage|spells?)[^.]* can't be (?:prevented|countered)[^.]*you control/, "Uncounterable"],
      ]),
  },
  {
    category: "Counterspells",
    test: (_card, t) => first(t, [[/counter target (?:spell|activated|triggered|ability|noncreature|creature|instant)/, "Counters spells"]]),
  },
  {
    category: "Graveyard Recursion",
    test: (_card, t) =>
      first(t, [
        [/return [^.]*from your graveyard to (?:your hand|the battlefield)/, "Returns cards from your graveyard"],
        [/return target [^.]*card from your graveyard/, "Returns cards from your graveyard"],
        [/put [^.]*card from (?:a|your) graveyard onto the battlefield/, "Reanimates"],
        [/(?:you may )?(?:cast|play) [^.]*from your graveyard/, "Casts from graveyard"],
        [/\b(?:flashback|unearth|escape|retrace|embalm|eternalize)\b/, "Self-recursion keyword"],
      ]),
  },
  {
    category: "Tutors",
    test: (_card, t) => {
      const m = /search your library for ([^.]*?)card/.exec(t);
      if (!m) return null;
      // Land searches are ramp/fixing, not tutors.
      if (/\bland\b|plains|island|swamp|mountain|forest/.test(m[1])) return null;
      return "Searches your library";
    },
  },
  {
    category: "Token Generation",
    test: (_card, t) => {
      // Ignore tokens made for opponents (Beast Within) and doublers (Parallel Lives).
      const own = ownTokenText(t);
      if (!/\bcreates? [^.]*?\btokens?\b|\binvestigate\b/.test(own)) return null;
      return /creature token|\d+\/\d+|x\/x/.test(own) ? "Makes creature tokens" : "Makes tokens";
    },
  },
  {
    category: "Lifegain",
    test: (card, t) => {
      if (hasKeyword(card, "Lifelink") || /\blifelink\b/.test(t)) return "Lifelink";
      return first(t, [
        [/you gain (?:\d+|x|that much|life equal)/, "Gains life"],
        [/gains? \d+ life|gain life/, "Gains life"],
        [/create[^.]*food tokens?/, "Makes Food (life on demand)"],
      ]);
    },
  },
  {
    category: "Sacrifice Outlets",
    test: (_card, t) =>
      first(t, [
        [/sacrifice (?:a|an|another|one or more|any number of|x) (?:other )?(?:creature|permanent|artifact|token|nontoken|food|treasure|clue|land)s?[^:.]*:/, "Free or repeatable sacrifice"],
        [/, sacrifice (?:a|another) (?:creature|artifact|permanent)[^:.]*:/, "Sacrifice as a cost"],
      ]),
  },
  {
    category: "Finishers",
    test: (card, t) => {
      const reason = first(t, [
        [/you win the game/, "Alternate win condition"],
        [/additional combat phase/, "Extra combat"],
        [/creatures you control get \+(?:\d+|x)\/\+(?:\d+|x)[^.]*(?:trample|until end of turn)/, "Team pump / overrun"],
        [/(?:target|each) opponent loses (?:that much|x) life|loses life equal to/, "Life drain engine"],
        [/double (?:the damage|strike)[^.]*creatures you control|creatures you control have double strike/, "Damage multiplier"],
        [/each opponent loses \d+ life[^.]*(?:whenever|for each)/, "Repeatable drain"],
        [/whenever [^.]*(?:each opponent|target opponent|target player|each player) loses \d+ life/, "Repeatable drain"],
      ]);
      if (reason) return reason;
      const power = Number(card.power);
      if (hasType(card, "Creature") && Number.isFinite(power) && power >= 7) return "Large threat";
      return null;
    },
  },
];

export interface CategoryMatch {
  category: FunctionalCategory;
  reason: string;
}

const matchCache = new WeakMap<Card, CategoryMatch[]>();

/** Heuristic categories for a card (memoized). */
export function classifyCard(card: Card): CategoryMatch[] {
  const hit = matchCache.get(card);
  if (hit) return hit;
  const text = rulesText(card);
  const out: CategoryMatch[] = [];
  for (const rule of CATEGORY_RULES) {
    if (out.some((m) => m.category === rule.category)) continue;
    const reason = rule.test(card, text);
    if (reason) out.push({ category: rule.category, reason });
  }
  matchCache.set(card, out);
  return out;
}

/** Categories after applying the user's manual corrections. */
export function effectiveCategories(dc: Pick<DeckCard, "card" | "categoryOverrides">): FunctionalCategory[] {
  const auto = classifyCard(dc.card).map((m) => m.category);
  const add = dc.categoryOverrides?.add ?? [];
  const remove = new Set(dc.categoryOverrides?.remove ?? []);
  return [...new Set([...auto, ...add])].filter((c) => !remove.has(c));
}
