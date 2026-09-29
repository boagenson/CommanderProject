import type { Card, DeckTheme, SynergyInteraction, ThemeCardRole } from "@/lib/types";
import { creatureSubtypes, hasType, isLand } from "@/lib/cards/helpers";
import { rulesText } from "@/lib/analysis/text";
import { INTERACTION_RULES } from "./interactions";
import { THEMES, type ThemeDefinition } from "./themes";

export interface ThemeRole {
  themeId: string;
  role: "enabler" | "payoff" | "both";
}

/** Which themes a card participates in, and how. */
export function cardThemeRoles(card: Card, themes: ThemeDefinition[] = THEMES): ThemeRole[] {
  const text = rulesText(card);
  const out: ThemeRole[] = [];
  for (const theme of themes) {
    const e = theme.enabler(card, text);
    const p = theme.payoff(card, text);
    if (e || p) out.push({ themeId: theme.id, role: e && p ? "both" : e ? "enabler" : "payoff" });
  }
  return out;
}

interface AnalyzeThemesInput {
  commanders: Card[];
  /** Unique non-commander cards in the main deck. */
  cards: Card[];
}

const MIN_SCORE = 12;

/** Detect the deck's strongest themes and explain the interactions behind them. */
export function analyzeThemes({ commanders, cards }: AnalyzeThemesInput): DeckTheme[] {
  const all = [...commanders, ...cards];
  const commanderIds = new Set(commanders.map((c) => c.id));
  const nonland = all.filter((c) => !isLand(c));
  const scale = Math.max(25, nonland.length * 0.6);
  const texts = new Map(all.map((c) => [c.id, rulesText(c)]));

  // Specific interactions first; they boost related themes.
  const interactions: (SynergyInteraction & { themes: string[]; bonus: number })[] = [];
  for (const rule of INTERACTION_RULES) {
    const sources = all.filter((c) => rule.source(c, texts.get(c.id)!));
    if (!sources.length) continue;
    const sourceIds = new Set(sources.map((c) => c.id));
    const targets = all.filter((c) => !sourceIds.has(c.id) && rule.target(c, texts.get(c.id)!));
    if (!targets.length) continue;
    interactions.push({
      ruleId: rule.id,
      title: rule.title,
      explanation: rule.explain(sources, targets),
      sources: sources.map((c) => c.name),
      targets: targets.map((c) => c.name),
      themes: rule.themes,
      bonus: (rule.weight ?? 1) * Math.min(sources.length * targets.length, 4) * 0.5,
    });
  }

  const results: DeckTheme[] = [];
  for (const theme of THEMES) {
    const roles: ThemeCardRole[] = [];
    let raw = 0;
    for (const card of all) {
      const text = texts.get(card.id)!;
      const e = theme.enabler(card, text);
      const p = theme.payoff(card, text);
      if (!e && !p) continue;
      const mult = commanderIds.has(card.id) ? 2 : 1;
      raw += mult * ((e ? 1 : 0) + (p ? theme.payoffWeight ?? 1.25 : 0));
      roles.push({ name: card.name, role: e && p ? "both" : e ? "enabler" : "payoff" });
    }
    const enablers = roles.filter((r) => r.role !== "payoff").map((r) => r.name);
    const payoffs = roles.filter((r) => r.role !== "enabler").map((r) => r.name);
    if (!payoffs.length || roles.length < 3) continue;

    const related = interactions.filter((i) => i.themes.includes(theme.id));
    raw += related.reduce((n, i) => n + i.bonus, 0);
    const score = Math.min(100, Math.round((raw / scale) * 100));
    if (score < MIN_SCORE) continue;

    const themeInteraction: SynergyInteraction = {
      ruleId: `theme:${theme.id}`,
      title: `${theme.name} engine`,
      explanation: theme.explain(enablers, payoffs),
      sources: enablers,
      targets: payoffs,
    };
    results.push({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      score,
      cards: roles,
      interactions: [...related.map(stripInternal), themeInteraction],
    });
  }

  const typal = detectTypal(commanders, cards, texts, scale);
  if (typal) results.push(typal);

  return results.sort((a, b) => b.score - a.score);
}

function stripInternal(i: SynergyInteraction & { themes: string[]; bonus: number }): SynergyInteraction {
  return { ruleId: i.ruleId, title: i.title, explanation: i.explanation, sources: i.sources, targets: i.targets };
}

/** Creature-type strategies: common subtypes plus cards that reference them. */
function detectTypal(
  commanders: Card[],
  cards: Card[],
  texts: Map<string, string>,
  scale: number,
): DeckTheme | null {
  const all = [...commanders, ...cards];
  const counts = new Map<string, number>();
  for (const c of all) {
    if (!hasType(c, "Creature")) continue;
    for (const t of creatureSubtypes(c)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: { type: string; score: number; roles: ThemeCardRole[] } | null = null;
  for (const [type, count] of counts) {
    if (count < 3) continue;
    const lower = type.toLowerCase();
    // Plurals: Elf→Elves, Dwarf→Dwarves, Halfling→Halflings.
    const forms = [lower, `${lower}s`, lower.replace(/f$/, "ves")];
    const mentions = new RegExp(`\\b(?:${forms.join("|")})\\b`);
    const roles: ThemeCardRole[] = [];
    let raw = 0;
    for (const c of all) {
      const isType = creatureSubtypes(c).includes(type);
      const payoff = mentions.test(texts.get(c.id) ?? "") || /creatures? of the chosen type|shares? a creature type/.test(texts.get(c.id) ?? "");
      if (!isType && !payoff) continue;
      roles.push({ name: c.name, role: isType && payoff ? "both" : isType ? "enabler" : "payoff" });
      raw += (isType ? 0.6 : 0) + (payoff ? 2 : 0);
    }
    const payoffs = roles.filter((r) => r.role !== "enabler");
    if (!payoffs.length && count < 12) continue;
    const score = Math.min(100, Math.round((raw / scale) * 100));
    if (!best || score > best.score) best = { type, score, roles };
  }
  if (!best || best.score < MIN_SCORE) return null;
  const members = best.roles.filter((r) => r.role !== "payoff").map((r) => r.name);
  const payoffs = best.roles.filter((r) => r.role !== "enabler").map((r) => r.name);
  return {
    id: `typal-${best.type.toLowerCase()}`,
    name: `${best.type} Typal`,
    description: `A cluster of ${best.type} creatures and cards that care about them.`,
    score: best.score,
    cards: best.roles,
    interactions: payoffs.length
      ? [
          {
            ruleId: "typal",
            title: `${best.type} payoffs`,
            explanation: `${payoffs.slice(0, 4).join(", ")} reward the deck's ${members.length} ${best.type} creatures.`,
            sources: members,
            targets: payoffs,
          },
        ]
      : [],
  };
}
