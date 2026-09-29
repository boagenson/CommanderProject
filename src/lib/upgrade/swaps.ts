/**
 * Pair recommended additions with cuts to produce REMOVE → ADD swaps.
 * Never modifies the deck; the UI applies swaps only after user approval.
 */
import type { Deck, DeckAnalysis, DeckRecommendation, UpgradeGoal, UpgradeOptions, UpgradeSuggestion } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { commanderIdentity, isCommanderLegal, isWithinIdentity } from "@/lib/rules/commander";
import { GOAL_CATEGORIES, STRATEGY_PROFILES, computeNeeds, perCardCap, type ScoringContext } from "./context";
import { rankCuts, scoreCandidate, type CutCandidate } from "./score";
import type { CandidatePool } from "./candidates";

export function buildContext(deck: Deck, analysis: DeckAnalysis, options: UpgradeOptions): ScoringContext {
  return {
    identity: commanderIdentity(deck.commanders.map((c) => c.card)),
    analysis,
    options,
    profile: STRATEGY_PROFILES[options.strategy],
    needs: computeNeeds(analysis, options.goals),
    perCardCap: perCardCap(options.budget, options.maxSwaps),
    deckOracleIds: new Set([...deck.cards.map((d) => d.card.oracleId), ...deck.commanders.map((c) => c.card.oracleId)]),
  };
}

/** Score and filter a candidate pool into recommendations, best first. */
export function recommend(deck: Deck, ctx: ScoringContext, pool: CandidatePool, limit = 40): DeckRecommendation[] {
  const deckCards = [...deck.commanders.map((c) => c.card), ...deck.cards.map((d) => d.card)];
  const recs: DeckRecommendation[] = [];
  for (const card of pool.cards) {
    if (ctx.deckOracleIds.has(card.oracleId)) continue;
    if (!isCommanderLegal(card) || !isWithinIdentity(card, ctx.identity)) continue;
    const price = card.prices.usd;
    if (price != null && price > ctx.perCardCap) continue;
    if (isLand(card) && !ctx.options.goals.includes("Better Mana Base")) continue;
    const rec = scoreCandidate(card, ctx, deckCards, 1 - (pool.rank.get(card.oracleId) ?? 0.5));
    if (rec.reasons.length === 0) continue; // Nothing specific to say: not a real fit.
    recs.push(rec);
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Greedily pair the best additions with the weakest cuts, preferring
 * like-for-like swaps and staying within budget and the swap limit.
 */
export function planSwaps(deck: Deck, ctx: ScoringContext, recs: DeckRecommendation[]): UpgradeSuggestion[] {
  const cuts = rankCuts(deck.cards, ctx);
  const used = new Set<string>();
  const out: UpgradeSuggestion[] = [];
  let spent = 0;

  for (const rec of prioritizeGoals(recs, ctx)) {
    if (out.length >= ctx.options.maxSwaps) break;
    const price = rec.card.prices.usd ?? 0;
    if (spent + price > ctx.options.budget + 1e-9) continue;

    const addIsLand = isLand(rec.card);
    const pool = cuts.filter((c) => !used.has(c.deckCard.card.oracleId) && isLand(c.deckCard.card) === addIsLand);
    const cut = pickCut(rec, pool);
    if (!cut) continue;
    // Only suggest swaps that are an improvement by our own measure.
    if (rec.score <= cut.value) continue;

    used.add(cut.deckCard.card.oracleId);
    spent += price;
    const removed = cut.deckCard.card;
    out.push({
      id: `${removed.oracleId}->${rec.card.oracleId}`,
      remove: removed,
      add: rec.card,
      priceDelta: round2(price - (removed.prices.usd ?? 0)),
      manaValueDelta: rec.card.cmc - removed.cmc,
      removedCategories: cut.categories,
      addedCategories: rec.categories,
      explanation: rec.reasons.slice(0, 3).join(" "),
      removeReason: cut.reason,
      score: round2(rec.score - cut.value),
    });
  }
  return out;
}

/** Each selected goal gets its best matching recommendation first, then the rest by score. */
function prioritizeGoals(recs: DeckRecommendation[], ctx: ScoringContext): DeckRecommendation[] {
  const addresses = (rec: DeckRecommendation, goal: UpgradeGoal) => {
    switch (goal) {
      case "Better Mana Base":
        return isLand(rec.card);
      case "Lower Mana Curve":
        return !isLand(rec.card) && rec.card.cmc < ctx.analysis.averageManaValue;
      case "More Synergy":
        return rec.themes.length > 0;
      default:
        return GOAL_CATEGORIES[goal].some((c) => rec.categories.includes(c));
    }
  };
  const first: DeckRecommendation[] = [];
  for (const goal of ctx.options.goals) {
    const best = recs.find((r) => !first.includes(r) && addresses(r, goal));
    if (best) first.push(best);
  }
  return [...first, ...recs.filter((r) => !first.includes(r))];
}

/** Prefer a cut sharing a category (like-for-like); else the weakest card overall. */
function pickCut(rec: DeckRecommendation, pool: CutCandidate[]): CutCandidate | undefined {
  const weakest = pool[0];
  if (!weakest) return undefined;
  const sameRole = pool.slice(0, 12).find((c) => c.categories.some((cat) => rec.categories.includes(cat)));
  if (sameRole && sameRole.value - weakest.value < 1) return sameRole;
  return weakest;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
