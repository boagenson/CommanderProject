/**
 * Deck Intent helpers: defaults for older decks, and a small deterministic
 * reader for the free-text goals so recommendations can use them without an
 * LLM. The parser only looks for known strategy names, theme words and a few
 * preference phrases; it never pretends to understand the whole sentence.
 */
import type { Deck, DeckIntent, PlayerPriority, StrategyName } from "@/lib/types";
import { DEFAULT_INTENT, STRATEGY_NAMES } from "@/lib/types";

export function getIntent(deck: Pick<Deck, "intent">): DeckIntent {
  return { ...DEFAULT_INTENT, ...deck.intent, secondaryStrategies: deck.intent?.secondaryStrategies ?? [], priorities: deck.intent?.priorities ?? [] };
}

/** Theme ids that each named strategy maps onto (for scoring boosts). */
export const STRATEGY_THEMES: Record<StrategyName, string[]> = {
  Food: ["food", "artifacts", "lifegain"],
  Tokens: ["tokens"],
  Aristocrats: ["aristocrats", "sacrifice"],
  Lifegain: ["lifegain"],
  Voltron: ["equipment"],
  Spellslinger: ["spellslinger"],
  Reanimator: ["graveyard"],
  Artifacts: ["artifacts", "treasure", "clues", "food"],
  Enchantress: ["enchantments"],
  Landfall: ["landfall"],
  Control: [],
  Combo: [],
  "Creature Typal": ["typal"],
  Counters: ["counters"],
  Blink: [],
  Sacrifice: ["sacrifice", "aristocrats"],
  Graveyard: ["graveyard"],
  Treasure: ["treasure", "artifacts"],
  Equipment: ["equipment"],
  "Group Hug": [],
  Stax: [],
};

/** Words in free text that point at a theme id. */
const THEME_WORDS: [RegExp, string][] = [
  [/\bfoods?\b/i, "food"],
  [/\btreasures?\b/i, "treasure"],
  [/\bclues?\b|\binvestigate\b/i, "clues"],
  [/\bartifacts?\b|artifact[- ]tokens?/i, "artifacts"],
  [/\btokens?\b|go[- ]wide/i, "tokens"],
  [/\blife ?gain\b|\bgain(?:ing)? life\b/i, "lifegain"],
  [/\baristocrats?\b|death triggers?/i, "aristocrats"],
  [/\bsacrifice\b|\bsac\b/i, "sacrifice"],
  [/\bgraveyard\b|\breanimat/i, "graveyard"],
  [/\bspellslinger\b|instants? and sorcer/i, "spellslinger"],
  [/\bequipment\b|\bvoltron\b/i, "equipment"],
  [/\benchant(?:ment|ress)/i, "enchantments"],
  [/\blandfall\b|\blands? matter/i, "landfall"],
  [/\+1\/\+1|\bcounters?\b/i, "counters"],
];

export interface GoalHints {
  /** Theme ids the player mentioned wanting more of. */
  boostThemes: string[];
  /** Strategy names mentioned. */
  strategies: StrategyName[];
  /** "don't turn it into generic good stuff", "keep the theme". */
  avoidGeneric: boolean;
  /** "more consistent", "reliable". */
  consistency: boolean;
  /** "budget", "cheap", "affordable". */
  budget: boolean;
  /** "faster", "explosive". */
  speed: boolean;
  /** "interaction", "removal", "answers". */
  interaction: boolean;
  /** "flavor", "themed", franchise references like Lord of the Rings. */
  flavor: boolean;
  /** Strategy or theme words following "not", "don't", "avoid". */
  avoidThemes: string[];
}

/** Deterministic reading of the goals text. Case-insensitive, phrase-based. */
export function parseGoals(text: string): GoalHints {
  const t = text ?? "";
  const hints: GoalHints = {
    boostThemes: [],
    strategies: [],
    avoidGeneric: /generic|good[- ]stuff|staples?|keep (?:it|the) (?:theme|flavor)|stay (?:on )?theme|remain[^.]*themed/i.test(t),
    consistency: /consisten|reliab|smooth|every game/i.test(t),
    budget: /\bbudget\b|\bcheap\b|affordable|\bunder \$?\d+/i.test(t),
    speed: /\bfast(?:er)?\b|explosive|\bspeed\b|aggressive/i.test(t),
    interaction: /interaction|removal|answers?\b|protect(?:ion)?/i.test(t),
    flavor: /flavou?r|themed|lord of the rings|middle[- ]earth|\blore\b|\bstory\b|\bvibe/i.test(t),
    avoidThemes: [],
  };
  const negated = [...t.matchAll(/\b(?:not|don't|dont|do not|avoid|never|no)\b([^.;,]{0,60})/gi)].map((m) => m[1]);
  for (const [re, id] of THEME_WORDS) {
    if (!re.test(t)) continue;
    const isNegated = negated.some((n) => re.test(n));
    if (isNegated) hints.avoidThemes.push(id);
    else hints.boostThemes.push(id);
  }
  for (const name of STRATEGY_NAMES) {
    const re = new RegExp(`\\b${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(t) && !negated.some((n) => re.test(n))) hints.strategies.push(name);
  }
  hints.boostThemes = [...new Set(hints.boostThemes)];
  hints.avoidThemes = [...new Set(hints.avoidThemes)];
  return hints;
}

/** Priorities as scoring weights (1 = neutral). */
export function priorityWeights(priorities: PlayerPriority[]) {
  const has = (p: PlayerPriority) => priorities.includes(p);
  return {
    synergy: 1 + (has("Synergy") ? 0.4 : 0) + (has("Theme") ? 0.3 : 0),
    theme: 1 + (has("Theme") ? 0.5 : 0) + (has("Flavor") ? 0.5 : 0),
    budget: 1 + (has("Budget") ? 0.8 : 0),
    consistency: 1 + (has("Consistency") ? 0.5 : 0),
    speed: 1 + (has("Speed") ? 0.5 : 0) + (has("Explosive Turns") ? 0.3 : 0),
    resilience: 1 + (has("Resilience") ? 0.6 : 0),
    interaction: 1 + (has("Interaction") ? 0.6 : 0),
    casual: has("Casual Table Experience") ? 1.5 : 1,
  };
}

export type PriorityWeights = ReturnType<typeof priorityWeights>;
