/**
 * Shared scoring context for recommendations and swaps: what the deck needs,
 * how much the player's intent cares about synergy vs. efficiency, budget
 * caps, protection tiers and hints read from the free-text goals.
 */
import type { Color, DeckAnalysis, DeckIntent, FunctionalCategory, ProtectionLevel, Strategy, StrategyName, UpgradeGoal, UpgradeOptions } from "@/lib/types";
import { FUNCTIONAL_CATEGORIES } from "@/lib/types";
import { parseGoals, priorityWeights, STRATEGY_THEMES, type GoalHints, type PriorityWeights } from "@/lib/deck/intent";

/** Rough targets used to measure "need"; informational, not rules. */
export const CATEGORY_TARGETS: Partial<Record<FunctionalCategory, number>> = {
  Ramp: 10,
  "Card Draw": 10,
  "Targeted Removal": 7,
  "Board Wipes": 2,
  Protection: 3,
  Counterspells: 0,
  "Graveyard Recursion": 2,
  Tutors: 2,
  Finishers: 3,
};

/** How much a card in each category is worth keeping, relative to others. */
export const CATEGORY_IMPORTANCE: Record<FunctionalCategory, number> = {
  Ramp: 1.2,
  "Mana Fixing": 0.6,
  "Card Draw": 1.2,
  "Card Advantage": 1.1,
  "Targeted Removal": 1.2,
  "Board Wipes": 1,
  Protection: 1,
  Counterspells: 1.2,
  "Graveyard Recursion": 0.9,
  Tutors: 1.5,
  "Token Generation": 0.6,
  Lifegain: 0.4,
  "Sacrifice Outlets": 0.7,
  Drain: 0.9,
  "Cost Reduction": 0.6,
  Enabler: 0.5,
  Payoff: 0.8,
  Finishers: 1.2,
  "Combo Piece": 1.3,
};

export const GOAL_CATEGORIES: Record<UpgradeGoal, FunctionalCategory[]> = {
  "More Ramp": ["Ramp"],
  "More Card Draw": ["Card Draw"],
  "More Interaction": ["Targeted Removal", "Counterspells", "Board Wipes"],
  "Better Mana Base": [],
  "Lower Mana Curve": [],
  "More Synergy": [],
  "Improve Win Conditions": ["Finishers"],
};

export interface StrategyProfile {
  /** Weight for theme/synergy fit. */
  synergy: number;
  /** Weight for mana efficiency (cheap, instant-speed). */
  efficiency: number;
  /** Weight for filling role gaps. */
  roles: number;
  /** Highest mana value we like to add. */
  softMaxMv: number;
}

export const STRATEGY_PROFILES: Record<Strategy, StrategyProfile> = {
  Casual: { synergy: 1.6, efficiency: 0.4, roles: 0.8, softMaxMv: 6 },
  Focused: { synergy: 1.3, efficiency: 0.8, roles: 1, softMaxMv: 5 },
  Optimized: { synergy: 1, efficiency: 1.2, roles: 1.2, softMaxMv: 4 },
  "High Power": { synergy: 0.8, efficiency: 1.6, roles: 1.3, softMaxMv: 4 },
};

export interface ScoringContext {
  identity: Color[];
  analysis: DeckAnalysis;
  options: UpgradeOptions;
  intent: DeckIntent;
  profile: StrategyProfile;
  weights: PriorityWeights;
  hints: GoalHints;
  /** Theme ids the intent wants strengthened (primary first). */
  intentThemes: string[];
  /** Theme ids the player asked not to lean into. */
  avoidThemes: string[];
  /** Per-category desire (0 = satisfied). */
  needs: Record<FunctionalCategory, number>;
  /** Maximum price for any single added card. */
  perCardCap: number;
  deckOracleIds: Set<string>;
  /** Protection level per oracle id (locked wins over favorite over flavor). */
  protection: Map<string, ProtectionLevel>;
  /** Whether Favorite cards may be cut at all under this philosophy. */
  mayCutFavorites: boolean;
}

export function perCardCap(budget: number, maxSwaps: number) {
  if (budget <= 0) return 0;
  if (maxSwaps <= 1) return budget;
  return Math.max(0.5, budget <= 10 ? budget * 0.5 : budget * 0.4);
}

export function computeNeeds(analysis: DeckAnalysis, goals: UpgradeGoal[], weights?: PriorityWeights, hints?: GoalHints): Record<FunctionalCategory, number> {
  const needs = Object.fromEntries(FUNCTIONAL_CATEGORIES.map((c) => [c, 0])) as Record<FunctionalCategory, number>;
  for (const [cat, target] of Object.entries(CATEGORY_TARGETS) as [FunctionalCategory, number][]) {
    const have = analysis.categories[cat].length;
    needs[cat] = Math.max(0, (target - have) / Math.max(1, target)); // 0..1
  }
  for (const g of goals) for (const cat of GOAL_CATEGORIES[g]) needs[cat] += 1;
  if (weights) {
    if (weights.interaction > 1) for (const cat of ["Targeted Removal", "Counterspells", "Board Wipes"] as const) needs[cat] += (weights.interaction - 1) * 0.6;
    if (weights.resilience > 1) for (const cat of ["Protection", "Graveyard Recursion"] as const) needs[cat] += (weights.resilience - 1) * 0.6;
    if (weights.consistency > 1) for (const cat of ["Card Draw", "Tutors", "Ramp"] as const) needs[cat] += (weights.consistency - 1) * 0.4;
    if (weights.speed > 1) needs.Ramp += (weights.speed - 1) * 0.5;
  }
  if (hints) {
    if (hints.interaction) for (const cat of ["Targeted Removal", "Protection"] as const) needs[cat] += 0.4;
    if (hints.consistency) for (const cat of ["Card Draw", "Tutors"] as const) needs[cat] += 0.3;
    if (hints.speed) needs.Ramp += 0.4;
  }
  return needs;
}

/** Theme ids that the intent wants, primary first, then secondary, then goal text. */
export function intentThemeIds(intent: DeckIntent, hints: GoalHints, detectedPrimary?: StrategyName): string[] {
  const out: string[] = [];
  const primary = intent.primaryStrategy ?? detectedPrimary;
  if (primary) out.push(...STRATEGY_THEMES[primary]);
  for (const s of intent.secondaryStrategies) out.push(...STRATEGY_THEMES[s]);
  for (const s of hints.strategies) out.push(...STRATEGY_THEMES[s]);
  out.push(...hints.boostThemes);
  return [...new Set(out)].filter((t) => !hints.avoidThemes.includes(t));
}

export { parseGoals, priorityWeights };
