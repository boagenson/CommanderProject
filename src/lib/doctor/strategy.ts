/**
 * Strategy / archetype detection: maps detected themes and role counts onto
 * the named strategies a player can pick in Deck Intent. Scores are 0–100.
 *
 * Theme-backed strategies come straight from the synergy engine. A few
 * strategies have no theme (Control, Combo, Blink, Voltron, Reanimator) and
 * are estimated from roles, combos and a handful of text patterns. Group Hug
 * and Stax are manual-only for now.
 */
import type { Card, DetectedCombo, DeckTheme, DetectedStrategy, FunctionalCategory, StrategyName } from "@/lib/types";
import { hasType, isLand } from "@/lib/cards/helpers";
import { rulesText } from "@/lib/analysis/text";
import { cardThemeRoles } from "@/lib/synergy/engine";

const THEME_TO_STRATEGY: Record<string, StrategyName> = {
  food: "Food",
  tokens: "Tokens",
  aristocrats: "Aristocrats",
  lifegain: "Lifegain",
  spellslinger: "Spellslinger",
  artifacts: "Artifacts",
  enchantments: "Enchantress",
  landfall: "Landfall",
  counters: "Counters",
  sacrifice: "Sacrifice",
  graveyard: "Graveyard",
  treasure: "Treasure",
  equipment: "Equipment",
  clues: "Artifacts",
};

export const STRATEGY_DESCRIPTIONS: Record<StrategyName, string> = {
  Food: "Make Food and turn it into life, cards and sacrifice triggers.",
  Tokens: "Go wide with creature tokens and reward width.",
  Aristocrats: "Sacrifice creatures for death-trigger value and drain.",
  Lifegain: "Gain life repeatedly and convert it into damage, counters or cards.",
  Voltron: "Load one creature, usually the commander, with Equipment or Auras and win through commander damage.",
  Spellslinger: "Cast many instants and sorceries to trigger spell payoffs.",
  Reanimator: "Put big creatures into the graveyard and return them cheaply.",
  Artifacts: "Build an artifact-dense board with artifact payoffs.",
  Enchantress: "Play enchantments and draw or trigger off each one.",
  Landfall: "Extra land drops and land recursion to trigger landfall.",
  Control: "Answer threats, wipe boards and win late with a few finishers.",
  Combo: "Assemble a known infinite combo with tutors and protection.",
  "Creature Typal": "Concentrate on one creature type and its lords and payoffs.",
  Counters: "Grow creatures with +1/+1 counters and proliferate.",
  Blink: "Repeatedly exile and return your own creatures for enters-the-battlefield value.",
  Sacrifice: "Sacrifice permanents on demand for value.",
  Graveyard: "Fill and use the graveyard as a second hand.",
  Treasure: "Generate Treasure for explosive mana and artifact synergies.",
  Equipment: "Equipment-focused board with equip cost reduction and payoffs.",
  "Group Hug": "Help every player draw and ramp while steering the table.",
  Stax: "Tax and restrict what opponents can do.",
};

export interface StrategyInput {
  commanders: Card[];
  cards: Card[];
  themes: DeckTheme[];
  roles: Map<string, FunctionalCategory[]>;
  combos: DetectedCombo[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function detectStrategies(input: StrategyInput): DetectedStrategy[] {
  const all = [...input.commanders, ...input.cards];
  const nonland = all.filter((c) => !isLand(c));
  const out = new Map<StrategyName, DetectedStrategy>();
  const push = (name: StrategyName, score: number, themes: string[], explanation: string) => {
    if (score < 12) return;
    const existing = out.get(name);
    if (existing) {
      existing.score = clamp(Math.max(existing.score, score) + Math.min(existing.score, score) * 0.2);
      existing.themes = [...new Set([...existing.themes, ...themes])];
      return;
    }
    out.set(name, { name, score: clamp(score), themes, explanation });
  };

  const commanderThemes = new Set(input.commanders.flatMap((c) => cardThemeRoles(c).map((r) => r.themeId)));
  for (const theme of input.themes) {
    // A theme with many enablers but almost no payoffs is a resource, not a strategy.
    const payoffCount = theme.cards.filter((c) => c.role !== "enabler").length;
    const payoffFactor = payoffCount >= 3 ? 1 : 0.55 + payoffCount * 0.15;
    const commanderBoost = commanderThemes.has(theme.id) ? 12 : 0;
    if (theme.id.startsWith("typal-")) {
      push("Creature Typal", theme.score, [theme.id], `${theme.cards.filter((c) => c.role !== "payoff").length} ${theme.name.replace(/ Typal$/, "")} creatures plus payoffs that reference the type.`);
      continue;
    }
    const name = THEME_TO_STRATEGY[theme.id];
    if (!name) continue;
    const payoffs = payoffCount;
    const enablers = theme.cards.filter((c) => c.role !== "payoff").length;
    push(name, theme.score * payoffFactor + commanderBoost, [theme.id], `${enablers} enabler${enablers === 1 ? "" : "s"} and ${payoffs} payoff${payoffs === 1 ? "" : "s"} for the ${theme.name} theme${commanderBoost ? ", and a commander that participates in it" : ""}.`);
  }

  // Role-based strategies.
  const count = (role: FunctionalCategory) => [...input.roles.values()].filter((rs) => rs.includes(role)).length;
  const interaction = count("Targeted Removal") + count("Counterspells") + count("Board Wipes");
  const creatures = nonland.filter((c) => hasType(c, "Creature")).length;
  if (interaction >= 12 && creatures <= 20) {
    push("Control", 30 + (interaction - 12) * 4 + (20 - creatures) * 1.5, [], `${interaction} pieces of interaction with only ${creatures} creatures.`);
  }

  const infinite = input.combos.filter((c) => c.type === "infinite").length;
  const tutors = count("Tutors");
  if (infinite) push("Combo", 25 + infinite * 12 + tutors * 4, [], `${infinite} known infinite combo${infinite === 1 ? "" : "s"} and ${tutors} tutor${tutors === 1 ? "" : "s"}.`);

  const recursion = count("Graveyard Recursion");
  const reanimate = nonland.filter((c) => /put [^.]*creature card from (?:a|your) graveyard onto the battlefield|return [^.]*creature card from your graveyard to the battlefield/.test(rulesText(c))).length;
  if (reanimate >= 3) push("Reanimator", 20 + reanimate * 10 + recursion * 2, ["graveyard"], `${reanimate} reanimation effects and ${recursion} recursion pieces.`);

  const blink = nonland.filter((c) => /exile [^.]*(?:creature|permanent)s? you (?:own|control)[^.]*return (?:it|them|that card|those cards) to the battlefield/.test(rulesText(c))).length;
  const etbs = nonland.filter((c) => /when ~ enters/.test(rulesText(c))).length;
  if (blink >= 3) push("Blink", 20 + blink * 10 + Math.min(etbs, 15) * 1.5, [], `${blink} flicker effects with ${etbs} enters-the-battlefield triggers to reuse.`);

  const suits = nonland.filter((c) => /\bEquipment\b/.test(c.typeLine) || (/\bAura\b/.test(c.typeLine) && /enchant creature/.test(rulesText(c)))).length;
  const cmdText = input.commanders.map(rulesText).join(" ");
  if (suits >= 6 || (suits >= 3 && /whenever ~ deals combat damage to a player|equipped|attach/.test(cmdText))) {
    push("Voltron", 20 + suits * 6 + (/whenever ~ deals combat damage to a player/.test(cmdText) ? 20 : 0), ["equipment"], `${suits} Equipment or Auras to load onto one creature.`);
  }

  return [...out.values()].sort((a, b) => b.score - a.score);
}

/** One or two sentences about what the commanders themselves want to do. */
export function describeCommanderStrategy(commanders: Card[], roles: Map<string, FunctionalCategory[]>, tags: Map<string, string[]>): string {
  if (!commanders.length) return "No commander selected yet, so the deck's direction is read from the 99 alone.";
  const parts = commanders.map((c) => {
    const r = (roles.get(c.name) ?? []).filter((x) => x !== "Enabler" && x !== "Payoff").slice(0, 3);
    const t = (tags.get(c.name) ?? []).filter((x) => x !== "Legendary").slice(0, 4);
    const bits: string[] = [];
    if (t.length) bits.push(`cares about ${t.join(", ")}`);
    if (r.length) bits.push(`provides ${r.join(", ")}`);
    return `${c.name.split(",")[0]} ${bits.length ? bits.join(" and ") : "sets the color identity"}`;
  });
  const shared = (commanders.length > 1 ? intersection(commanders.map((c) => tags.get(c.name) ?? [])) : []).filter((s) => s !== "Legendary");
  const tail = shared.length ? ` Both commanders overlap on ${shared.join(", ")}, which is the natural centre of the deck.` : "";
  return `${parts.join("; ")}.${tail}`;
}

function intersection(lists: string[][]) {
  return lists.reduce((acc, l) => acc.filter((x) => l.includes(x)));
}
