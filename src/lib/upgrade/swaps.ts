/**
 * Pair recommended additions with cuts to produce REMOVE → ADD swaps.
 * Never modifies the deck; the UI applies swaps only after user approval.
 */
import type { Deck, DeckAnalysis, DeckRecommendation, ProtectionLevel, UpgradeGoal, UpgradeOptions, UpgradeSuggestion } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { getIntent } from "@/lib/deck/intent";
import { commanderIdentity, isCommanderLegal, isWithinIdentity } from "@/lib/rules/commander";
import { GOAL_CATEGORIES, STRATEGY_PROFILES, computeNeeds, intentThemeIds, parseGoals, perCardCap, priorityWeights, type ScoringContext } from "./context";
import { rankCuts, scoreCandidate, type CutCandidate } from "./score";
import type { CandidatePool } from "./candidates";
import { detectStrategies } from "@/lib/doctor/strategy";

/** Protection level of a deck card (locked wins). */
export function protectionOf(dc: { locked?: boolean; favorite?: boolean; flavorEssential?: boolean }): ProtectionLevel | undefined {
  if (dc.locked) return "locked";
  if (dc.favorite) return "favorite";
  if (dc.flavorEssential) return "flavor";
  return undefined;
}

export function buildContext(deck: Deck, analysis: DeckAnalysis, options: UpgradeOptions): ScoringContext {
  const intent = options.intent ?? getIntent(deck);
  const hints = parseGoals(intent.goals);
  const weights = priorityWeights(intent.priorities);
  const roles = new Map(Object.values(analysis.cardCategories).map((c) => [c.name, c.categories]));
  const detected = detectStrategies({
    commanders: deck.commanders.map((c) => c.card),
    cards: deck.cards.filter((c) => (c.board ?? "main") === "main").map((c) => c.card),
    themes: analysis.themes,
    roles,
    combos: analysis.combos.filter((c) => c.type !== "near"),
  });
  const protection = new Map<string, ProtectionLevel>();
  for (const dc of deck.cards) {
    const p = protectionOf(dc);
    if (p) protection.set(dc.card.oracleId, p);
  }
  // Power level from intent unless the workshop overrides it.
  const strategy = options.strategy ?? intent.power;
  return {
    identity: commanderIdentity(deck.commanders.map((c) => c.card)),
    analysis,
    options: { ...options, strategy },
    intent,
    profile: STRATEGY_PROFILES[strategy],
    weights,
    hints,
    intentThemes: intentThemeIds(intent, hints, detected[0]?.name),
    avoidThemes: hints.avoidThemes,
    needs: computeNeeds(analysis, options.goals, weights, hints),
    perCardCap: perCardCap(options.budget, options.maxSwaps),
    deckOracleIds: new Set([...deck.cards.map((d) => d.card.oracleId), ...deck.commanders.map((c) => c.card.oracleId)]),
    protection,
    mayCutFavorites: intent.philosophy === "Maximum Optimization",
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
    const lowerCurve = ctx.options.goals.includes("Lower Mana Curve");
    const pool = cuts.filter(
      (c) =>
        !used.has(c.deckCard.card.oracleId) &&
        isLand(c.deckCard.card) === addIsLand &&
        // With "Lower Mana Curve", a swap never raises mana value.
        !(lowerCurve && !addIsLand && rec.card.cmc > c.deckCard.card.cmc),
    );
    const cut = pickCut(rec, pool);
    if (!cut) continue;
    // Only suggest swaps that are an improvement by our own measure.
    if (rec.score <= cut.value) continue;

    used.add(cut.deckCard.card.oracleId);
    spent += price;
    const removed = cut.deckCard.card;
    const removeReason = cut.protection === "favorite"
      ? `${cut.reason} You marked it a favorite; it is only suggested because the upgrade philosophy is Maximum Optimization.`
      : cut.protection === "flavor"
        ? `${cut.reason} It is marked Flavor Essential, so this is offered reluctantly; keep it if the theme matters more than the slot.`
        : cut.reason;
    out.push({
      id: `${removed.oracleId}->${rec.card.oracleId}`,
      remove: removed,
      add: rec.card,
      removeProtection: cut.protection,
      priceDelta: round2(price - (removed.prices.usd ?? 0)),
      manaValueDelta: rec.card.cmc - removed.cmc,
      removedCategories: cut.categories,
      addedCategories: rec.categories,
      explanation: rec.reasons.slice(0, 3).join(" "),
      removeReason,
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

/**
 * Prefer a cut sharing a category (like-for-like); else the weakest card overall.
 * Never replace a card with a pricier-in-mana card doing the same job
 * (Birds of Paradise → Fellwar Stone is a downgrade, not an upgrade).
 * Protected (favorite/flavor) cards are only chosen when nothing else is left.
 */
function pickCut(rec: DeckRecommendation, all: CutCandidate[]): CutCandidate | undefined {
  const pool = all.filter(
    (c) => !(c.deckCard.card.cmc < rec.card.cmc && c.categories.some((cat) => rec.categories.includes(cat))),
  );
  const unprotected = pool.filter((c) => !c.protection);
  const candidates = unprotected.length ? unprotected : pool;
  const weakest = candidates[0];
  if (!weakest) return undefined;
  const sameRole = candidates.slice(0, 12).find((c) => c.categories.some((cat) => rec.categories.includes(cat)));
  if (sameRole && sameRole.value - weakest.value < 1) return sameRole;
  return weakest;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
