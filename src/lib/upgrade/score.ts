/**
 * Scoring for cards to add (recommendations) and cards to cut.
 *
 * Popularity is only a small tie-breaker: fit with the deck's themes,
 * packages, interactions, gaps and the player's stated intent drives the
 * score, so cheap on-plan cards beat expensive generic staples. Every reason
 * mentions something specific about THIS deck (counts, package names,
 * partner cards) rather than "this is a strong card".
 */
import type { Card, DeckCard, DeckRecommendation, FunctionalCategory, ProtectionLevel } from "@/lib/types";
import { creatureSubtypes, hasType, isBasicLand, isLand } from "@/lib/cards/helpers";
import { classifyCard, effectiveCategories } from "@/lib/analysis/categories";
import { classifyTags } from "@/lib/analysis/tags";
import { rulesText } from "@/lib/analysis/text";
import { findCombos } from "@/lib/combo/engine";
import { cardThemeRoles } from "@/lib/synergy/engine";
import { INTERACTION_RULES } from "@/lib/synergy/interactions";
import { CATEGORY_IMPORTANCE, CATEGORY_TARGETS, type ScoringContext } from "./context";

const ROLE_WEIGHT = { enabler: 1, payoff: 1.5, both: 2 } as const;

/** Roles that read as "generic good stuff" when a card has nothing else going for it. */
const GENERIC_ROLES = new Set<FunctionalCategory>(["Ramp", "Card Draw", "Targeted Removal", "Board Wipes", "Counterspells", "Tutors"]);

export function scoreCandidate(card: Card, ctx: ScoringContext, deckCards: Card[], popularity = 0.5): DeckRecommendation {
  const { analysis, profile, needs, options, weights, hints } = ctx;
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
        target
          ? `Your deck currently has ${have} card${have === 1 ? "" : "s"} classified as ${cat}; many decks run around ${target}, so this fills a gap rather than duplicating a role.`
          : `Adds ${cat}, which your goals asked for.`,
      );
    }
  }
  score += roleScore * profile.roles;

  // Theme fit, weighted by intent
  const themeNames: string[] = [];
  let themeScore = 0;
  const themesById = new Map(analysis.themes.map((t) => [t.id, t]));
  const intentSet = new Set(ctx.intentThemes);
  const avoidSet = new Set(ctx.avoidThemes);
  for (const role of cardThemeRoles(card)) {
    const theme = themesById.get(role.themeId);
    const wanted = intentSet.has(role.themeId);
    if (!theme && !wanted) continue;
    if (avoidSet.has(role.themeId)) {
      score -= 1;
      continue;
    }
    const strength = theme ? theme.score / 100 : 0.3;
    const base = strength * ROLE_WEIGHT[role.role] * 1.5 * (wanted ? 1.6 : 1) * weights.theme;
    themeScore += base;
    const name = theme?.name ?? role.themeId;
    themeNames.push(name);
    const enablers = theme ? theme.cards.filter((c) => c.role !== "payoff").length : 0;
    const payoffs = theme ? theme.cards.filter((c) => c.role !== "enabler").length : 0;
    if (role.role === "payoff") {
      reasons.push(
        enablers
          ? `Your deck has ${enablers} ${name} enabler${enablers === 1 ? "" : "s"} but ${payoffs} payoff${payoffs === 1 ? "" : "s"}; this converts what you already produce into ${payoffText(role.themeId)}.`
          : `Payoff for the ${name} theme you asked for.`,
      );
    } else if (role.role === "both") {
      reasons.push(`Both fuels and rewards your ${name} theme (${enablers} enablers, ${payoffs} payoffs today).`);
    } else {
      reasons.push(
        payoffs
          ? `Feeds your ${payoffs} ${name} payoff${payoffs === 1 ? "" : "s"}${payoffs > enablers ? ", which currently outnumber the cards producing the resource" : ""}.`
          : `Adds ${name} production toward the strategy you chose.`,
      );
    }
  }
  const typal = analysis.themes.find((t) => t.id.startsWith("typal-"));
  if (typal) {
    const type = typal.name.replace(/ Typal$/, "");
    const text = rulesText(card);
    if (creatureSubtypes(card).includes(type) || text.includes(type.toLowerCase())) {
      themeScore += (typal.score / 100) * 1.5 * (intentSet.has("typal") ? 1.6 : 1);
      themeNames.push(typal.name);
      reasons.push(`Fits your ${typal.cards.length}-card ${type} typal cluster.`);
    }
  }
  if (options.goals.includes("More Synergy")) themeScore *= 1.4;
  score += themeScore * profile.synergy * weights.synergy;

  // Packages: does this card slot into an existing package?
  for (const pkg of analysis.packages) {
    const tags = new Set(classifyTags(card).map((t) => t.value));
    const roles = cardThemeRoles(card).map((r) => r.themeId);
    if (!pkg.themes.some((t) => roles.includes(t))) continue;
    if (pkg.strength >= 30 && tags.size) {
      score += 0.4 * weights.synergy;
      reasons.push(`Slots into your ${pkg.name} (${pkg.enablers.length + pkg.payoffs.length} cards).`);
      break;
    }
  }

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
    score += bonus * profile.synergy * weights.synergy;
    reasons.push(
      isSource
        ? `${rule.title}: boosts ${partners.slice(0, 3).map((p) => p.name).join(", ")}${partners.length > 3 ? ` and ${partners.length - 3} more` : ""} already in the deck.`
        : `${rule.title}: works with ${partners.slice(0, 2).map((p) => p.name).join(" and ")}.`,
    );
  }

  // Completes a near-combo already in the deck?
  const near = findCombos([...deckCards.map((d) => d.name), card.name], { includeNear: false }).filter((c) => c.present.includes(card.name));
  for (const c of near) {
    const existing = deckCards.filter((d) => c.present.includes(d.name)).map((d) => d.name);
    if (!existing.length) continue;
    const casual = weights.casual > 1 && c.type === "infinite";
    score += casual ? -1 : c.type === "infinite" ? 2.5 : 1.2;
    reasons.push(
      casual
        ? `Completes the ${c.definition.name} infinite combo with ${existing.join(" and ")}; skipped weight because you asked for a casual table experience.`
        : `Completes ${c.definition.name} with ${existing.join(" and ")} already in the deck: ${c.definition.result}`,
    );
  }

  // Mana efficiency
  if (!isLand(card)) {
    const mv = card.cmc;
    if (mv <= 2) {
      score += 0.6 * profile.efficiency * weights.speed;
      if (profile.efficiency >= 1) reasons.push(`Efficient at ${mv} mana against a deck average of ${analysis.averageManaValue.toFixed(2)}.`);
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
    const tapped = /enters (?:the battlefield )?tapped/i.test(card.oracleText);
    if (useful >= 2) {
      score += 3 + (useful - 2) * 0.4 + (tapped ? 0 : 0.6);
      const short = analysis.mana.demand.filter((d) => d.gap > 0.1 && card.producedMana.includes(d.color)).map((d) => d.color);
      reasons.push(
        short.length
          ? `Produces ${short.join("/")}, which your pips ask for more often than your lands provide${tapped ? "" : ", without always entering tapped"}.`
          : `Produces ${useful} of your colors${tapped ? "" : " without always entering tapped"}.`,
      );
    } else {
      score -= 2;
    }
  }

  // Generic-staple penalty: a card whose only merit is a utility role, when
  // the player asked to preserve theme or avoid good-stuff, scores lower.
  const onlyGeneric = categories.length > 0 && categories.every((c) => GENERIC_ROLES.has(c)) && themeNames.length === 0;
  if (onlyGeneric && (ctx.intent.philosophy === "Preserve Theme" || hints.avoidGeneric)) {
    score -= 1.2 * weights.theme;
  }

  // Price: gentle pressure toward budget-friendly picks, stronger when asked
  const price = card.prices.usd;
  if (price != null && ctx.perCardCap > 0) score -= (price / ctx.perCardCap) * 0.4 * weights.budget;
  if (price != null && weights.budget > 1 && price <= 2) reasons.push(`Costs ${price.toFixed(2)}, in line with your budget priority.`);
  score += popularity * 0.3;

  return {
    card,
    score: Math.round(score * 100) / 100,
    reasons: [...new Set(reasons)],
    categories,
    themes: [...new Set(themeNames)],
  };
}

function payoffText(themeId: string) {
  switch (themeId) {
    case "food":
      return "pressure or cards instead of only 3 life";
    case "treasure":
      return "value beyond a one-shot mana boost";
    case "tokens":
      return "damage or cards from going wide";
    case "aristocrats":
    case "sacrifice":
      return "drain or card draw";
    case "lifegain":
      return "damage, counters or cards";
    default:
      return "a real advantage";
  }
}

export interface CutCandidate {
  deckCard: DeckCard;
  value: number;
  reason: string;
  categories: FunctionalCategory[];
  protection?: ProtectionLevel;
}

/**
 * Rank the deck's cards from least to most valuable to keep.
 * - Locked cards are never listed.
 * - Favorites are listed only when the philosophy allows cutting them, and
 *   with a large value bonus so they go last.
 * - Flavor Essential cards get a thematic bonus proportional to how much the
 *   player cares about theme, so they are cut only when clearly dead weight.
 */
export function rankCuts(deckCards: DeckCard[], ctx: ScoringContext): CutCandidate[] {
  const { analysis, profile, options, weights } = ctx;
  const themesById = new Map(analysis.themes.map((t) => [t.id, t]));
  const interactionNames = new Set(analysis.themes.flatMap((t) => t.interactions.filter((i) => !i.ruleId.startsWith("theme:")).flatMap((i) => [...i.sources, ...i.targets])));
  const typal = analysis.themes.find((t) => t.id.startsWith("typal-"));
  const degree = new Map(analysis.graph.nodes.map((n) => [n.name, n.degree]));
  const maxDegree = Math.max(1, ...analysis.graph.nodes.map((n) => n.degree));
  const intentSet = new Set(ctx.intentThemes);

  const out: CutCandidate[] = [];
  for (const dc of deckCards) {
    if ((dc.board ?? "main") !== "main") continue;
    const protection = ctx.protection.get(dc.card.oracleId);
    if (protection === "locked") continue;
    if (protection === "favorite" && !ctx.mayCutFavorites) continue;
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
      if (have > target * 1.5 && CATEGORY_TARGETS[cat]) notes.push(`it's one of ${have} ${cat} cards`);
    }
    for (const role of cardThemeRoles(card)) {
      const theme = themesById.get(role.themeId);
      if (theme) value += (theme.score / 100) * ROLE_WEIGHT[role.role] * 1.2 * profile.synergy * weights.synergy * (intentSet.has(role.themeId) ? 1.5 : 1);
    }
    if (typal && typal.cards.some((c) => c.name === card.name)) value += (typal.score / 100) * profile.synergy;
    if (interactionNames.has(card.name)) value += 1.5;
    value += ((degree.get(card.name) ?? 0) / maxDegree) * 1.2 * weights.synergy;

    if (protection === "favorite") value += 4;
    if (protection === "flavor") value += 1.5 * weights.theme;

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

    const connected = (degree.get(card.name) ?? 0) > 0 || cardThemeRoles(card).some((r) => themesById.has(r.themeId));
    const reason = land
      ? "It's a basic land, and a dual land covers more of your colors."
      : !cats.length && !connected
        ? `It has no detected role and appears less connected to the deck's primary themes${notes.length ? `, and ${notes.join(" and ")}` : ""}.`
        : notes.length
          ? `${capitalize(notes.join(" and "))}.`
          : connected
            ? "Among the connected cards, it's one of the weaker links to the deck's plan."
            : "It's one of the least connected cards to the deck's plan.";

    out.push({ deckCard: dc, value: Math.round(value * 100) / 100, reason, categories: cats, protection });
  }
  return out.sort((a, b) => a.value - b.value);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
