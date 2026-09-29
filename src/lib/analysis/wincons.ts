/**
 * Win condition analysis: how does this deck probably close games?
 *
 * Each win condition type has a scorer that looks at roles, tags, themes and
 * detected combos. Scores are 0–100 and phrased as likelihoods, never as
 * guarantees; a deck with no type above `CLEAR_THRESHOLD` is flagged as
 * lacking a clear finishing plan. Manual overrides add or remove types.
 */
import type {
  Card,
  Classification,
  DetectedCombo,
  DeckTheme,
  FunctionalCategory,
  Overrides,
  ThematicTag,
  WinCondition,
  WinConditionReport,
  WinConditionType,
} from "@/lib/types";
import { WIN_CONDITION_TYPES } from "@/lib/types";
import { hasType, isLand } from "@/lib/cards/helpers";
import { rulesText } from "./text";

export const CLEAR_THRESHOLD = 35;

export interface WinConInput {
  commanders: Card[];
  cards: Card[];
  roles: Map<string, Classification<FunctionalCategory>[]>;
  tags: Map<string, Classification<ThematicTag>[]>;
  themes: DeckTheme[];
  combos: DetectedCombo[];
  overrides?: Overrides<WinConditionType>;
}

interface Scored {
  strength: number;
  cards: string[];
  explanation: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const names = (cards: Card[], max = 5) => cards.slice(0, max).map((c) => c.name);
const themeScore = (themes: DeckTheme[], id: string) => themes.find((t) => t.id === id)?.score ?? 0;

type Scorer = (input: WinConInput, all: Card[]) => Scored;

const SCORERS: Record<WinConditionType, Scorer> = {
  "Combat damage": (input, all) => {
    const creatures = all.filter((c) => hasType(c, "Creature") && !isLand(c));
    const threats = creatures.filter((c) => Number(c.power) >= 4 || (Number(c.power) >= 2 && /\btrample\b|\bflying\b|\bmenace\b|\bdouble strike\b/.test(rulesText(c))));
    const support = all.filter((c) => /additional combat|creatures you control get \+|creatures you control have (?:double strike|trample|haste)/.test(rulesText(c)));
    const strength = clamp(threats.length * 5 + support.length * 12 + (creatures.length > 25 ? 10 : 0));
    return {
      strength,
      cards: [...names(support), ...names(threats, 4)],
      explanation: `${threats.length} creature${threats.length === 1 ? "" : "s"} with evasion or 4+ power and ${support.length} team-wide combat boost${support.length === 1 ? "" : "s"}.`,
    };
  },
  "Commander damage": (input, all) => {
    const cmdCreature = input.commanders.some((c) => hasType(c, "Creature"));
    if (!cmdCreature) return { strength: 0, cards: [], explanation: "No creature commander." };
    const suits = all.filter((c) => /\bEquipment\b/.test(c.typeLine) || (/\bAura\b/.test(c.typeLine) && /enchant creature/.test(rulesText(c))));
    const cmdText = input.commanders.map(rulesText).join(" ");
    const voltronText = /whenever ~ deals combat damage to a player|~ gets \+|equipped|double strike|attach/.test(cmdText);
    const strength = clamp(suits.length * 9 + (voltronText ? 20 : 0));
    return {
      strength,
      cards: names(suits, 6),
      explanation: `${suits.length} Equipment or Aura${suits.length === 1 ? "" : "s"} to load onto a commander${voltronText ? ", and a commander that wants to connect in combat" : ""}.`,
    };
  },
  "Token swarm": (input, all) => {
    const t = themeScore(input.themes, "tokens");
    const anthems = all.filter((c) => /creatures you control get \+|for each creature you control|creature tokens you control get/.test(rulesText(c)));
    const makers = all.filter((c) => input.roles.get(c.name)?.some((r) => r.value === "Token Generation" && /creature/i.test(r.reason)));
    const strength = clamp(t * 0.7 + anthems.length * 10 + Math.min(makers.length, 8) * 3);
    return { strength, cards: [...names(anthems), ...names(makers, 4)], explanation: `Token theme strength ${t}, ${makers.length} creature-token makers and ${anthems.length} anthem-style payoffs.` };
  },
  "Life drain": (input, all) => {
    const drains = all.filter((c) => input.roles.get(c.name)?.some((r) => r.value === "Drain"));
    const lifegain = themeScore(input.themes, "lifegain");
    const loops = input.combos.filter((c) => c.type === "infinite" && /drain/i.test(c.definition.result));
    const strength = clamp(drains.length * 12 + lifegain * 0.3 + loops.length * 25);
    return { strength, cards: names(drains, 6), explanation: `${drains.length} card${drains.length === 1 ? "" : "s"} make opponents lose life${lifegain ? `, fed by a lifegain theme at ${lifegain}` : ""}.` };
  },
  Aristocrats: (input, all) => {
    const t = themeScore(input.themes, "aristocrats");
    const outlets = all.filter((c) => input.roles.get(c.name)?.some((r) => r.value === "Sacrifice Outlets"));
    const payoffs = all.filter((c) => input.tags.get(c.name)?.some((r) => r.value === "Death Trigger") && input.roles.get(c.name)?.some((r) => r.value === "Drain"));
    const strength = clamp(t * 0.6 + Math.min(outlets.length, 5) * 6 + payoffs.length * 12);
    return { strength, cards: [...names(payoffs), ...names(outlets, 3)], explanation: `${outlets.length} sacrifice outlet${outlets.length === 1 ? "" : "s"} and ${payoffs.length} death-trigger drain payoff${payoffs.length === 1 ? "" : "s"}.` };
  },
  "Infinite combo": (input) => {
    const infinite = input.combos.filter((c) => c.type === "infinite");
    const tutors = [...input.roles.values()].filter((rs) => rs.some((r) => r.value === "Tutors")).length;
    const strength = clamp(infinite.length * 40 + (infinite.length ? tutors * 6 : 0));
    return {
      strength,
      cards: infinite.flatMap((c) => c.present).slice(0, 6),
      explanation: infinite.length
        ? `${infinite.length} known infinite combo${infinite.length === 1 ? "" : "s"} present${tutors ? `, with ${tutors} tutor${tutors === 1 ? "" : "s"} to find the pieces` : ""}.`
        : "No known infinite combos found in the built-in database. Many Commander decks win without one.",
    };
  },
  "Large creatures": (_input, all) => {
    const big = all.filter((c) => hasType(c, "Creature") && Number(c.power) >= 6);
    const strength = clamp(big.length * 9);
    return { strength, cards: names(big, 6), explanation: `${big.length} creature${big.length === 1 ? "" : "s"} with power 6 or more.` };
  },
  "Alternate win condition": (_input, all) => {
    const alt = all.filter((c) => /you win the game|each opponent loses the game|poison counters?|\binfect\b/.test(rulesText(c)));
    const strength = clamp(alt.length * 35);
    return { strength, cards: names(alt), explanation: alt.length ? `${alt.length} card${alt.length === 1 ? "" : "s"} can win or make opponents lose outside of damage.` : "No alternate win conditions detected." };
  },
  "Value engine": (input, all) => {
    const engines = all.filter((c) => input.roles.get(c.name)?.some((r) => r.value === "Card Advantage"));
    const engineCombos = input.combos.filter((c) => c.type === "engine");
    const strength = clamp(Math.min(engines.length, 12) * 4 + engineCombos.length * 12);
    return { strength, cards: [...engineCombos.flatMap((c) => c.present), ...names(engines, 4)].slice(0, 6), explanation: `${engines.length} repeatable card-advantage sources and ${engineCombos.length} named value engine${engineCombos.length === 1 ? "" : "s"}.` };
  },
};

export function analyzeWinConditions(input: WinConInput): WinConditionReport {
  const all = [...input.commanders, ...input.cards].filter((c) => !isLand(c));
  const add = new Set(input.overrides?.add ?? []);
  const remove = new Set(input.overrides?.remove ?? []);
  const conditions: WinCondition[] = [];
  for (const type of WIN_CONDITION_TYPES) {
    if (remove.has(type)) continue;
    const s = SCORERS[type](input, all);
    const manual = add.has(type);
    if (!manual && s.strength < 15) continue;
    conditions.push({ type, strength: manual ? Math.max(s.strength, 60) : s.strength, cards: s.cards, explanation: s.explanation, manual });
  }
  conditions.sort((a, b) => b.strength - a.strength);
  const unclear = !conditions.some((c) => c.strength >= CLEAR_THRESHOLD);
  return {
    conditions,
    unclear,
    note: unclear
      ? "Commander Workshop could not identify a clear finishing plan. That may be fine for a value-oriented deck, but consider testing whether games stall once you're ahead."
      : `Likely closes games through ${conditions
          .filter((c) => c.strength >= CLEAR_THRESHOLD)
          .slice(0, 2)
          .map((c) => c.type.toLowerCase())
          .join(" and ")}. Strengths are estimates from card text, not guarantees.`,
  };
}
