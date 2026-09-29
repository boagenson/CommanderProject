/**
 * Specific card-to-card interactions beyond broad themes, e.g. a replacement
 * effect that multiplies what other cards produce. Each rule finds *sources*
 * and *targets* in the deck by rules text and explains the relationship.
 * Add new interactions by appending to `INTERACTION_RULES`.
 */
import type { Card } from "@/lib/types";
import { DEATH_TRIGGER, ownTokenText, rulesText } from "@/lib/analysis/text";
import type { Matcher } from "./themes";

export interface InteractionRule {
  id: string;
  title: string;
  /** Themes this interaction strengthens (boosts their score). */
  themes: string[];
  source: Matcher;
  target: Matcher;
  explain: (sources: Card[], targets: Card[]) => string;
  /** How much each source×target pair adds to theme scores. */
  weight?: number;
}

const names = (cards: Card[], max = 4) => {
  const n = cards.map((c) => c.name);
  return n.length <= max ? n.join(", ") : `${n.slice(0, max).join(", ")} and ${n.length - max} more`;
};

const TOKEN_KINDS = ["clue", "food", "treasure", "blood", "map"] as const;

/** "If you would create a Clue, Food, or Treasure token, instead create one of each." */
function replacementKinds(text: string): string[] {
  const m = /if you would create (?:a|an|one or more) ([^.]*?) tokens?[^.]*instead create/.exec(text);
  if (!m) return [];
  return TOKEN_KINDS.filter((k) => m[1].includes(k));
}

function createsKind(text: string, kind: string) {
  if (kind === "clue" && /\binvestigate\b/.test(text)) return true;
  return new RegExp(`create[^.]*\\b${kind}\\b[^.]*tokens?`).test(text);
}

export const INTERACTION_RULES: InteractionRule[] = [
  {
    id: "artifact-token-replacement",
    title: "Artifact token multiplication",
    themes: ["food", "treasure", "clues", "artifacts"],
    source: (_c, t) => replacementKinds(t).length > 1,
    target: (_c, t) => TOKEN_KINDS.some((k) => createsKind(t, k)) && replacementKinds(t).length === 0,
    explain: (s, t) => {
      const kinds = replacementKinds(s[0] ? rulesText(s[0]) : "").map(cap);
      return `${names(s)} replace${s.length === 1 ? "s" : ""} each ${kinds.join(", ")} token you would create with one of each. So every token made by ${names(t)} also produces the others: a Food maker also makes a Treasure (ramp) and a Clue (card draw).`;
    },
    weight: 3,
  },
  {
    id: "token-doubler",
    title: "Token doubling",
    themes: ["tokens", "food", "treasure", "clues", "artifacts"],
    source: (_c, t) =>
      /(?:if (?:an effect|you) would create one or more tokens|tokens would be created)[^.]*(?:twice that many|that many plus)/.test(t) ||
      /create twice that many of those tokens/.test(t),
    target: (_c, t) => /create[^.]*tokens?|\binvestigate\b/.test(ownTokenText(t)),
    explain: (s, t) => `${names(s)} increase${s.length === 1 ? "s" : ""} every token made by ${names(t)}.`,
    weight: 2,
  },
  {
    id: "lifegain-drain-loop",
    title: "Lifegain ↔ life-loss loop",
    themes: ["lifegain"],
    source: (_c, t) => /whenever you gain life, [^.]*opponent loses (?:that much|\d+) life/.test(t),
    target: (_c, t) => /whenever an opponent loses life[^.]*you gain (?:that much|\d+) life/.test(t),
    explain: (s, t) =>
      `${names(s)} and ${names(t)} trigger each other: gaining life drains an opponent, which gains you life again. Together they form a loop that can win on the spot.`,
    weight: 6,
  },
  {
    id: "food-lifegain",
    title: "Food fuels lifegain",
    themes: ["food", "lifegain"],
    source: (_c, t) => createsKind(t, "food"),
    target: (_c, t) => /whenever you gain life|if you (?:have )?gained (?:\d+|three) or more life|gained life this turn/.test(t),
    explain: (s, t) =>
      `Sacrificing Food from ${names(s)} gains 3 life, which counts toward ${names(t)}.`,
    weight: 1,
  },
  {
    id: "sac-outlet-death-trigger",
    title: "Sacrifice outlets + death triggers",
    themes: ["aristocrats", "sacrifice"],
    source: (_c, t) => /sacrifice (?:a|an|another) (?:other )?creature[^:.]*:/.test(t),
    target: (_c, t) => DEATH_TRIGGER.test(t),
    explain: (s, t) =>
      `${names(s)} let you sacrifice creatures at will, turning each death into a trigger for ${names(t)}.`,
    weight: 1.5,
  },
  {
    id: "treasure-sac-payoff",
    title: "Treasure sacrifice payoffs",
    themes: ["treasure", "sacrifice"],
    source: (_c, t) => createsKind(t, "treasure"),
    target: (_c, t) => /whenever you sacrifice (?:a|an|one or more|another) (?:treasure|artifact|permanent)/.test(t),
    explain: (s, t) => `Cracking Treasure from ${names(s)} triggers ${names(t)}.`,
    weight: 1,
  },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
