import type { Deck, DeckAnalysis, DeckRecommendation, UpgradeOptions, UpgradeSuggestion } from "@/lib/types";
import { buildCandidateQueries, fetchCandidates } from "./candidates";
import { buildContext, planSwaps, recommend } from "./swaps";

export interface UpgradePlan {
  suggestions: UpgradeSuggestion[];
  recommendations: DeckRecommendation[];
  errors: string[];
  queriesRun: number;
}

/** Fetch candidates from Scryfall and produce recommendations plus swaps. */
export async function generateUpgradePlan(
  deck: Deck,
  analysis: DeckAnalysis,
  options: UpgradeOptions,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<UpgradePlan> {
  const ctx = buildContext(deck, analysis, options);
  const queries = buildCandidateQueries(ctx);
  const pool = await fetchCandidates(queries, opts);
  const recommendations = recommend(deck, ctx, pool);
  const suggestions = planSwaps(deck, ctx, recommendations);
  return { suggestions, recommendations, errors: pool.errors, queriesRun: queries.length };
}

export { buildContext, planSwaps, recommend } from "./swaps";
export { buildCandidateQueries, fetchCandidates } from "./candidates";
export { rankCuts, scoreCandidate } from "./score";
export { STRATEGY_PROFILES } from "./context";
