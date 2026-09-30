/**
 * Functional role classification heuristics.
 *
 * Each rule inspects oracle text, types and keywords rather than card names,
 * so new cards are categorized without code changes. Add a rule by appending
 * to `CATEGORY_RULES`. Rules return a short reason shown to the user, which
 * also makes misclassifications easy to spot and correct manually, plus a
 * confidence (0–1) describing how literal the match was: an explicit
 * "draw a card" is near-certain, a large creature being a "Finisher" is not.
 *
 * Manual overrides (`categoryOverrides`) always win over detection.
 */
import type { Card, Classification, Commander, DeckCard, FunctionalCategory } from "@/lib/types";
import { hasType, isLand } from "@/lib/cards/helpers";
import { DEATH_TRIGGER, hasKeyword, ownTokenText, rulesText } from "./text";

export interface CategoryHit {
  reason: string;
  confidence: number;
}

export interface CategoryRule {
  category: FunctionalCategory;
  /** Return a hit when the card matches, else null. */
  test: (card: Card, text: string) => CategoryHit | null;
}

type Pattern = [RegExp, string, number?];

const DEFAULT_CONFIDENCE = 0.85;

/** First matching pattern wins; the optional third element is its confidence. */
const first = (text: string, patterns: Pattern[]): CategoryHit | null => {
  for (const [re, reason, confidence] of patterns) {
    if (re.test(text)) return { reason, confidence: confidence ?? DEFAULT_CONFIDENCE };
  }
  return null;
};

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Ramp",
    test: (card, t) => {
      if (isLand(card)) return null;
      return first(t, [
        [/search your library for [^.]*\b(?:lands?|forest|plains|island|swamp|mountain)\b[^.]*cards?[^.]*onto the battlefield/, "Puts lands onto the battlefield", 0.95],
        [/put (?:a|up to \w+) land cards? from your hand onto the battlefield/, "Cheats lands into play", 0.9],
        [/you may play (?:an )?additional lands?/, "Extra land drops", 0.85],
        [/\badd (?:\{[wubrgc]\}|one mana|two mana|three mana|x mana|mana|an amount of)/, "Produces mana", 0.95],
        [/create (?:a|one|two|three|x|that many) (?:tapped )?treasure tokens?/, "Makes Treasure", 0.8],
        [/(?:spells|creature spells) you cast cost \{\d\} less/, "Cost reduction", 0.6],
      ]);
    },
  },
  {
    category: "Mana Fixing",
    test: (card, t) => {
      if (isLand(card)) {
        const colors = new Set(card.producedMana.filter((m) => m !== "C"));
        if (colors.size >= 2) return { reason: `Land that makes ${colors.size} colors`, confidence: 0.95 };
        if (/search your library for [^.]*land/.test(t)) return { reason: "Fetches a land of a needed type", confidence: 0.8 };
        return null;
      }
      const colors = new Set(card.producedMana.filter((m) => m !== "C"));
      if (colors.size >= 2 && /\badd/.test(t)) return { reason: `Produces ${colors.size >= 5 ? "any color" : `${colors.size} colors`}`, confidence: 0.9 };
      if (/search your library for [^.]*(?:plains|island|swamp|mountain|forest)[^.]*card/.test(t)) return { reason: "Fetches typed lands", confidence: 0.8 };
      return null;
    },
  },
  {
    category: "Card Draw",
    test: (_card, t) =>
      first(t, [
        [/(?<!opponent |each player |target player |target opponent |that player )draws? (?:a|an additional|two|three|four|five|x|that many|cards equal)[^.]*cards?/, "Draws cards", 0.95],
        [/\binvestigate\b|create (?:a|one|two|x) clue tokens?/, "Makes Clues", 0.8],
        [/exile the top [^.]*of your library[^.]*you may (?:play|cast)/, "Impulse draw", 0.8],
        [/look at the top [^.]*put [^.]*into your hand/, "Card selection into hand", 0.75],
      ]),
  },
  {
    category: "Card Advantage",
    test: (_card, t) =>
      first(t, [
        [/(?:whenever|at the beginning of)[^.]*(?<!opponent |each player |target player |that player )draws? (?:a|two|x|that many) cards?/, "Repeatable draw trigger", 0.85],
        [/if you would create (?:a|an|one or more) [^.]*tokens?[^.]*instead create/, "Multiplies token output into extra resources", 0.65],
        [/(?<!opponent |each player |target player |that player )draws? (?:two|three|four|five|x|that many) cards/, "Draws multiple cards", 0.85],
        [/return [^.]*(?:two|three|x|all|each) [^.]*cards? from your graveyard to your hand/, "Returns several cards", 0.7],
        [/create (?:two|three|x|that many) [^.]*tokens?/, "Makes several bodies at once", 0.55],
        [/(?:whenever|at the beginning of)[^.]*create (?:a|one) [^.]*tokens?/, "Repeatable token trigger", 0.6],
        [/exile the top [^.]*of your library[^.]*you may (?:play|cast)/, "Impulse draw", 0.6],
      ]),
  },
  {
    category: "Targeted Removal",
    test: (_card, t) => {
      const cleaned = t.replace(/target [^.,]*you control/g, "");
      return first(cleaned, [
        [/(?:destroy|exile) target (?!card)[^.]*(?:creature|permanent|artifact|enchantment|planeswalker|land|battle)/, "Destroys or exiles a target", 0.95],
        [/deals? (?:\d+|x) damage to (?:any target|target creature|target planeswalker|target attacking)/, "Damage-based removal", 0.8],
        [/target (?:creature|permanent)[^.]* gets? -\d+\/-\d+|target creature gets -x\/-x/, "Shrinks a target", 0.75],
        [/return target (?:nonland )?(?:creature|permanent|artifact|enchantment)[^.]* to (?:its|their) owner'?s? hand/, "Bounces a target", 0.7],
        [/target (?:player|opponent) sacrifices/, "Edict", 0.8],
        [/fights? (?:target|up to one target|another target)/, "Fight removal", 0.7],
      ]);
    },
  },
  {
    category: "Board Wipes",
    test: (_card, t) =>
      first(t, [
        [/(?:destroy|exile) all (?:other )?(?:creatures|nonland permanents|permanents|artifacts|enchantments|nontoken)/, "Mass destroy/exile", 0.95],
        [/(?:destroy|exile) each (?:other )?(?:creature|nonland permanent)/, "Mass destroy/exile", 0.95],
        [/(?:all|each) (?:other )?creatures? gets? -\d+\/-\d+|all creatures get -x\/-x/, "Mass shrink", 0.9],
        [/deals? (?:\d+|x) damage to each (?:other )?creature/, "Mass damage", 0.85],
        [/return all (?:nonland )?(?:permanents|creatures) to their owners'? hands/, "Mass bounce", 0.85],
        [/each player sacrifices (?:all|x|two|three)/, "Mass sacrifice", 0.8],
      ]),
  },
  {
    category: "Protection",
    test: (_card, t) =>
      first(t, [
        [/(?:creatures|permanents|artifacts|you and permanents) you control (?:gain|have|get)[^.]*(?:hexproof|indestructible|shroud|protection)/, "Protects your board", 0.95],
        [/target (?:creature|permanent|artifact)[^.]* you control gains? [^.]*(?:hexproof|indestructible|shroud|protection)/, "Protects a permanent", 0.85],
        [/(?:equipped|enchanted) creature (?:has|gains|gets)[^.]*(?:hexproof|indestructible|shroud|protection)/, "Protective Equipment/Aura", 0.8],
        [/phase out/, "Phasing protection", 0.8],
        [/you have hexproof|you (?:gain|have) protection from/, "Protects you", 0.85],
        [/(?:damage|spells?)[^.]* can't be (?:prevented|countered)[^.]*you control/, "Uncounterable", 0.6],
        [/(?:target creature|~) gains indestructible until end of turn/, "Grants indestructible", 0.7],
      ]),
  },
  {
    category: "Counterspells",
    test: (_card, t) => first(t, [[/counter target (?:spell|activated|triggered|ability|noncreature|creature|instant)/, "Counters spells", 0.95]]),
  },
  {
    category: "Graveyard Recursion",
    test: (_card, t) =>
      first(t, [
        [/return [^.]*from your graveyard to (?:your hand|the battlefield)/, "Returns cards from your graveyard", 0.95],
        [/return target [^.]*card from your graveyard/, "Returns cards from your graveyard", 0.95],
        [/put [^.]*card from (?:a|your) graveyard onto the battlefield/, "Reanimates", 0.9],
        [/(?:you may )?(?:cast|play) [^.]*from your graveyard/, "Casts from graveyard", 0.8],
        [/\b(?:flashback|unearth|escape|retrace|embalm|eternalize)\b/, "Self-recursion keyword", 0.7],
      ]),
  },
  {
    category: "Tutors",
    test: (_card, t) => {
      const m = /search your library for ([^.]*?)card/.exec(t);
      if (!m) return null;
      // Land searches are ramp/fixing, not tutors.
      if (/\bland\b|plains|island|swamp|mountain|forest/.test(m[1])) return null;
      return { reason: "Searches your library", confidence: m[1].trim() === "a" ? 0.95 : 0.85 };
    },
  },
  {
    category: "Token Generation",
    test: (_card, t) => {
      // Ignore tokens made for opponents (Beast Within) and doublers (Parallel Lives).
      const own = ownTokenText(t);
      if (!/\bcreates? [^.]*?\btokens?\b|\binvestigate\b/.test(own)) return null;
      return /creature token|\d+\/\d+|x\/x/.test(own)
        ? { reason: "Makes creature tokens", confidence: 0.9 }
        : { reason: "Makes tokens", confidence: 0.85 };
    },
  },
  {
    category: "Lifegain",
    test: (card, t) => {
      if (hasKeyword(card, "Lifelink") || /\blifelink\b/.test(t)) return { reason: "Lifelink", confidence: 0.9 };
      return first(t, [
        [/you gain (?:\d+|x|that much|life equal)/, "Gains life", 0.9],
        [/gains? \d+ life|gain life/, "Gains life", 0.8],
        [/create[^.]*food tokens?/, "Makes Food (life on demand)", 0.6],
      ]);
    },
  },
  {
    category: "Sacrifice Outlets",
    test: (_card, t) =>
      first(t, [
        [/sacrifice (?:a|an|another|one or more|any number of|x) (?:other )?(?:creature|permanent|artifact|token|nontoken|food|treasure|clue|land)s?[^:.]*:/, "Free or repeatable sacrifice", 0.95],
        [/, sacrifice (?:a|another) (?:creature|artifact|permanent)[^:.]*:/, "Sacrifice as a cost", 0.85],
        [/as an additional cost to cast this spell, sacrifice/, "One-shot sacrifice", 0.5],
      ]),
  },
  {
    category: "Drain",
    test: (_card, t) =>
      first(t, [
        [/(?:each|target) opponent loses (?:\d+|x|that much) life/, "Makes opponents lose life", 0.9],
        [/target player loses \d+ life/, "Makes a player lose life", 0.75],
        [/loses life equal to/, "Life loss scaling", 0.8],
        [/deals? (?:\d+|x) damage to each opponent/, "Damages each opponent", 0.8],
      ]),
  },
  {
    category: "Cost Reduction",
    test: (_card, t) =>
      first(t, [
        [/(?:spells?|abilities|creature spells|artifact spells|instant and sorcery spells)[^.]* cost \{?\w\}? less/, "Reduces costs", 0.9],
        [/costs? \{\d\} less to (?:cast|activate)/, "Reduces costs", 0.85],
        [/\baffinity for\b|\bimprovise\b|\bconvoke\b|\bdelve\b/, "Alternative cost payment", 0.6],
      ]),
  },
  {
    category: "Finishers",
    test: (card, t) => {
      const hit = first(t, [
        [/you win the game/, "Alternate win condition", 0.95],
        [/additional combat phase/, "Extra combat", 0.85],
        [/creatures you control get \+(?:\d+|x)\/\+(?:\d+|x)[^.]*(?:trample|until end of turn)/, "Team pump / overrun", 0.8],
        [/(?:target|each) opponent loses (?:that much|x) life|loses life equal to/, "Life drain engine", 0.85],
        [/double (?:the damage|strike)[^.]*creatures you control|creatures you control have double strike/, "Damage multiplier", 0.8],
        [/each opponent loses \d+ life[^.]*(?:whenever|for each)/, "Repeatable drain", 0.75],
        [/whenever [^.]*(?:each opponent|target opponent|target player|each player) loses \d+ life/, "Repeatable drain", 0.75],
        [/\binfect\b|\bpoison counters?\b/, "Poison", 0.7],
      ]);
      if (hit) return hit;
      const power = Number(card.power);
      if (hasType(card, "Creature") && Number.isFinite(power) && power >= 7) return { reason: "Large threat", confidence: 0.45 };
      return null;
    },
  },
  {
    category: "Enabler",
    test: (_card, t) => {
      const own = ownTokenText(t);
      return first(own, [
        [/create[^.]*\b(?:food|treasure|clue|blood|map)\b[^.]*tokens?|\binvestigate\b/, "Produces artifact tokens for payoffs", 0.7],
        [/if you would create (?:a|an|one or more) [^.]*tokens?[^.]*instead/, "Turns every token trigger into more tokens", 0.65],
        [/(?:whenever|at the beginning of)[^.]*create [^.]*creature tokens?/, "Streams creature tokens", 0.7],
        [/\bmill\b|\bsurveil\b|put the top [^.]*into your graveyard|discard (?:a|two|x) cards?/, "Fills the graveyard", 0.6],
        [/put (?:a|one|two|three|x|that many) \+1\/\+1 counters?|\bproliferate\b/, "Adds counters", 0.6],
        [/you may play (?:an )?additional lands?|search your library for [^.]*land[^.]*onto the battlefield/, "Triggers landfall repeatedly", 0.5],
      ]);
    },
  },
  {
    category: "Payoff",
    test: (_card, t) =>
      first(t, [
        [/if you would create (?:a|an|one or more) [^.]*tokens?[^.]*instead/, "Multiplies token creation", 0.9],
        [/whenever you (?:create|sacrifice|gain life|cast)[^.]*, /, "Triggers on the deck's actions", 0.75],
        [/whenever (?:a|an|another|one or more) (?:nontoken |other )?(?:artifact|creature|token|enchantment|land)s? (?:you control )?(?:enters|dies|is put into)/, "Triggers on permanents entering or dying", 0.7],
        [/for each (?:artifact|creature|token|enchantment|land|food|treasure|clue) you control/, "Scales with what you control", 0.8],
        [DEATH_TRIGGER, "Death trigger payoff", 0.75],
        [/\blandfall\b|\bconstellation\b|\bmagecraft\b|\bprowess\b|whenever you gain life/, "Keyword payoff", 0.85],
      ]),
  },
];

export interface CategoryMatch {
  category: FunctionalCategory;
  reason: string;
  confidence: number;
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
    const res = rule.test(card, text);
    if (res) out.push({ category: rule.category, reason: res.reason, confidence: res.confidence });
  }
  matchCache.set(card, out);
  return out;
}

type Classifiable = Pick<DeckCard, "card" | "categoryOverrides"> | Pick<Commander, "card" | "categoryOverrides">;

/** Categories after applying the user's manual corrections. */
export function effectiveCategories(dc: Classifiable): FunctionalCategory[] {
  return effectiveRoles(dc).map((r) => r.value);
}

/** Role classifications with confidence after applying overrides. Manual wins. */
export function effectiveRoles(dc: Classifiable): Classification<FunctionalCategory>[] {
  const add = dc.categoryOverrides?.add ?? [];
  const remove = new Set(dc.categoryOverrides?.remove ?? []);
  const out: Classification<FunctionalCategory>[] = [];
  for (const m of classifyCard(dc.card)) {
    if (remove.has(m.category)) continue;
    const manual = add.includes(m.category);
    out.push({ value: m.category, confidence: manual ? 1 : m.confidence, reason: manual ? "Confirmed by you" : m.reason, manual });
  }
  for (const c of add) {
    if (remove.has(c) || out.some((o) => o.value === c)) continue;
    out.push({ value: c, confidence: 1, reason: "Set by you", manual: true });
  }
  return out;
}
