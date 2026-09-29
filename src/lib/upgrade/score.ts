/**
 * Scoring for cards to add (recommendations) and cards to cut.
 * Popularity is only a small tie-breaker: fit with the deck's themes,
 * interactions and gaps drives the score, so cheap on-plan cards beat
 * expensive generic staples.
 */
import type { Card, DeckCard, DeckRecommendation, FunctionalCategory } from "@/lib/types";
import { creatureSubtypes, hasType, isBasicLand, isLand } from "@/lib/cards/helpers";
import { classifyCard, effectiveCategories } from "@/lib/analysis/categories";
import { rulesText } from "@/lib/analysis/text";
import { cardThemeRoles } from "@/lib/synergy/engine";
import { INTERACTION_RULES } from "@/lib/synergy/interactions";
import { CATEGORY_IMPORTANCE, CATEGORY_TARGETS, type ScoringContext } from "./context";

const ROLE_WEIGHT = { enabler: 1, payoff: 1.5, both: 2 } as const;

export function scoreCandidate(
  card: Card,
  ctx: ScoringContext,
  deckCards: Card[],
  popularity = 0.5,
): DeckRecommendation {
  const { analysis, profile, needs, options } = ctx;
  const reasons: string[] = [];
  let score = 0;

  // Role gaps
  const categories = classifyCard(card).map((m) => m.category);
  let roleScore = 0;
  for (const cat of categories) {
    const need = needs[cat];
    if (need > 0) {
      roleScore += need * 2;
      const have = analysis.categories[cat].length;
      const target = CATEGORY_TARGETS[cat];
      reasons.push(
        target ? `Adds ${cat} (deck has ${have}, many decks run ~${target}).` : `Adds ${cat}, which your goals asked for.`,
      );
    }
  }
  score += roleScore * profile.roles;

  // Theme fit
  const themeNames: string[] = [];
  let themeScore = 0;
  const themesById = new Map(analysis.themes.map((t) => [t.id, t]));
  for (const role of cardThemeRoles(card)) {
    const theme = themesById.get(role.themeId);
    if (!theme) continue;
    themeScore += (theme.score / 100) * ROLE_WEIGHT[role.role] * 1.5;
    themeNames.push(theme.name);
    reasons.push(
      role.role === "payoff"
        ? `Payoff for your ${theme.name} theme.`
        : role.role === "both"
          ? `Both fuels and rewards your ${theme.name} theme.`
          : `Feeds your ${theme.name} theme.`,
    );
  }
  const typal = analysis.themes.find((t) => t.id.startsWith("typal-"));
  if (typal) {
    const type = typal.name.replace(/ Typal$/, "");
    const text = rulesText(card);
    if (creatureSubtypes(card).includes(type) || text.includes(type.toLowerCase())) {
      themeScore += (typal.score / 100) * 1.5;
      themeNames.push(typal.name);
      reasons.push(`Fits your ${type} typal cards.`);
    }
  }
  if (options.goals.includes("More Synergy")) themeScore *= 1.4;
  score += themeScore * profile.synergy;

  // Specific interactions with cards already in the deck
  const text = rulesText(card);
  for (const rule of INTERACTION_RULES) {
    const isSource = rule.source(card, text);
    const isTarget = rule.target(card, text);
    if (!isSource && !isTarget) continue;
    const partners = deckCards.filter((d) => {
      const t = rulesText(d);
      return isSource ? rule.target(d, t) : rule.source(d, t);
    });
    if (!partners.length) continue;
    const bonus = (rule.weight ?? 1) * Math.min(partners.length, 4) * 0.4;
    score += bonus * profile.synergy;
    reasons.push(
      isSource
        ? `${rule.title}: boosts ${partners.slice(0, 3).map((p) => p.name).join(", ")}${partners.length > 3 ? ` and ${partners.length - 3} more` : ""}.`
        : `${rule.title}: works with ${partners.slice(0, 2).map((p) => p.name).join(" and ")}.`,
    );
  }

  // Mana efficiency
  if (!isLand(card)) {
    const mv = card.cmc;
    if (mv <= 2) {
      score += 0.6 * profile.efficiency;
      if (profile.efficiency >= 1) reasons.push(`Efficient at ${mv} mana.`);
    }
    if (mv > profile.softMaxMv) score -= (mv - profile.softMaxMv) * 0.6 * profile.efficiency;
    if (options.goals.includes("Lower Mana Curve")) {
      score += Math.max(0, analysis.averageManaValue - mv) * 0.6;
      if (mv < analysis.averageManaValue) reasons.push(`Lowers the curve (MV ${mv} vs. deck average ${analysis.averageManaValue.toFixed(1)}).`);
    }
    if ((hasType(card, "Instant") || /\bflash\b/i.test(card.keywords.join(" "))) && categories.length) {
      score += 0.3 * profile.efficiency;
    }
  } else if (options.goals.includes("Better Mana Base")) {
    const useful = card.producedMana.filter((c) => c !== "C" && ctx.identity.includes(c)).length;
    if (useful >= 2) {
      score += 3 + (useful - 2) * 0.4 + (/enters (?:the battlefield )?tapped/i.test(card.oracleText) ? 0 : 0.6);
      reasons.push(`Produces ${useful} of your colors${/enters (?:the battlefield )?tapped/i.test(card.oracleText) ? "" : " without always entering tapped"}.`);
    } else {
      score -= 2;
    }
  }

  // Price: gentle pressure toward budget-friendly picks
  const price = card.prices.usd;
  if (price != null && ctx.perCardCap > 0) score -= (price / ctx.perCardCap) * 0.4;
  score += popularity * 0.3;

  return {
    card,
    score: Math.round(score * 100) / 100,
    reasons: [...new Set(reasons)],
    categories,
    themes: [...new Set(themeNames)],
  };
}

export interface CutCandidate {
  deckCard: DeckCard;
  value: number;
  reason: string;
  categories: FunctionalCategory[];
}

/** Rank the deck's cards from least to most valuable to keep. Locked cards are excluded. */
export function rankCuts(deckCards: DeckCard[], ctx: ScoringContext): CutCandidate[] {
  const { analysis, profile, options } = ctx;
  const themesById = new Map(analysis.themes.map((t) => [t.id, t]));
  const interactionNames = new Set(analysis.themes.flatMap((t) => t.interactions.filter((i) => !i.ruleId.startsWith("theme:")).flatMap((i) => [...i.sources, ...i.targets])));
  const typal = analysis.themes.find((t) => t.id.startsWith("typal-"));

  const out: CutCandidate[] = [];
  for (const dc of deckCards) {
    if (dc.locked || (dc.board ?? "main") !== "main") continue;
    const card = dc.card;
    const land = isLand(card);
    if (land && !(options.goals.includes("Better Mana Base") && isBasicLand(card))) continue;

    const cats = effectiveCategories(dc);
    let value = 0;
    const notes: string[] = [];
    for (const cat of cats) {
      const have = analysis.categories[cat].length;
      const target = CATEGORY_TARGETS[cat] ?? 4;
      const scarcity = have <= target ? 1.3 : have > target * 1.5 ? 0.6 : 1;
      value += CATEGORY_IMPORTANCE[cat] * scarcity;
      if (have > target * 1.5) notes.push(`it's one of ${have} ${cat} cards`);
    }
    for (const role of cardThemeRoles(card)) {
      const theme = themesById.get(role.themeId);
      if (theme) value += (theme.score / 100) * ROLE_WEIGHT[role.role] * 1.2 * profile.synergy;
    }
    if (typal && typal.cards.some((c) => c.name === card.name)) value += (typal.score / 100) * profile.synergy;
    if (interactionNames.has(card.name)) value += 1.5;

    if (!land) {
      // Cheap cards are worth as much to keep as they are to add (see scoreCandidate).
      if (card.cmc <= 2) value += 0.6 * profile.efficiency;
      const over = card.cmc - profile.softMaxMv;
      if (over > 0) {
        value -= over * 0.5 * (options.goals.includes("Lower Mana Curve") ? 2 : 1);
        notes.push(`it costs ${card.cmc} mana`);
      }
    } else {
      value = 0.2; // basic land, only cut for mana-base upgrades
      notes.push("basic land that can become a dual");
    }

    const reason = land
      ? "It's a basic land, and a dual land covers more of your colors."
      : !cats.length && value < 0.5
        ? `It has no detected role or theme connection${notes.length ? `, and ${notes.join(" and ")}` : ""}.`
        : notes.length
          ? `${capitalize(notes.join(" and "))}.`
          : "It's one of the least connected cards to the deck's plan.";

    out.push({ deckCard: dc, value: Math.round(value * 100) / 100, reason, categories: cats });
  }
  return out.sort((a, b) => a.value - b.value);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
