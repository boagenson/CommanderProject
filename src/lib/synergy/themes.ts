/**
 * Theme definitions for the synergy engine.
 *
 * A theme has *enablers* (cards that produce the resource or event) and
 * *payoffs* (cards that reward it). Both are detected from rules text and
 * types, so the engine works for cards it has never seen. To add a theme,
 * append a `ThemeDefinition` to `THEMES`; no other code needs to change.
 */
import type { Card } from "@/lib/types";
import { hasType, isLand } from "@/lib/cards/helpers";
import { hasKeyword } from "@/lib/analysis/text";

export type Matcher = (card: Card, text: string) => boolean;

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  enabler: Matcher;
  payoff: Matcher;
  /** Explains how enablers feed payoffs; used for the theme's interaction. */
  explain: (enablers: string[], payoffs: string[]) => string;
  /** Payoffs are weighted more than enablers when scoring. */
  payoffWeight?: number;
}

const re = (pattern: RegExp): Matcher => (_c, t) => pattern.test(t);
const any = (...ms: Matcher[]): Matcher => (c, t) => ms.some((m) => m(c, t));
const list = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;

const makesToken = (kind: string) =>
  new RegExp(`create[^.]*\\b${kind}\\b[^.]*tokens?|\\b${kind === "clue" ? "investigate" : "__never__"}\\b`);

export const THEMES: ThemeDefinition[] = [
  {
    id: "food",
    name: "Food",
    description: "Make Food tokens and cash them in for life, cards, or other value.",
    enabler: re(makesToken("food")),
    payoff: re(/sacrifice (?:a|one or more|x) foods?|foods? you control|whenever you sacrifice a food|food tokens? you control|if you would create a[^.]*food/),
    explain: (e, p) =>
      `${list(e)} create Food, which ${list(p)} turn into extra value. Each Food is also a 3-life gain on demand, feeding lifegain triggers.`,
    payoffWeight: 1.5,
  },
  {
    id: "treasure",
    name: "Treasure",
    description: "Generate Treasure for ramp and sacrifice synergies.",
    enabler: re(makesToken("treasure")),
    payoff: re(/sacrifice (?:a|one or more) treasures?|treasures? you control|whenever you sacrifice a treasure|if you would create a[^.]*treasure/),
    explain: (e, p) => `${list(e)} make Treasure; ${list(p)} reward having or sacrificing it.`,
    payoffWeight: 1.5,
  },
  {
    id: "clues",
    name: "Clues",
    description: "Investigate for card advantage and sacrifice triggers.",
    enabler: re(makesToken("clue")),
    payoff: re(/sacrifice (?:a|one or more) clues?|clues? you control|whenever you sacrifice a clue|if you would create a[^.]*clue/),
    explain: (e, p) => `${list(e)} create Clues that ${list(p)} make more valuable.`,
    payoffWeight: 1.5,
  },
  {
    id: "artifacts",
    name: "Artifacts & Artifact Tokens",
    description: "Build a board of artifacts, especially Food, Treasure and Clue tokens.",
    enabler: any(
      (c) => hasType(c, "Artifact") && !isLand(c),
      re(/create[^.]*\b(?:treasure|food|clue|blood|map|powerstone|gold|artifact)\b[^.]*tokens?|\binvestigate\b/),
    ),
    payoff: re(/whenever (?:an?|one or more|another) (?:nontoken )?artifacts? (?:you control )?(?:enters|is put into|are put into)|for each artifact you control|artifacts? you control (?:have|get)|\baffinity for artifacts\b|\bimprovise\b|sacrifice (?:an|another) artifact|number of artifacts you control|whenever you sacrifice (?:an|one or more) artifacts?|if you would create a (?:clue|food|treasure)/),
    explain: (e, p) => `${list(p)} scale with artifacts, and ${list(e)} keep them coming.`,
  },
  {
    id: "tokens",
    name: "Tokens (Go Wide)",
    description: "Flood the board with creature tokens and reward width.",
    enabler: re(/create[^.]*(?:\d+\/\d+|x\/x)[^.]*creature tokens?|create[^.]*creature tokens?/),
    payoff: re(/creatures you control get \+|for each creature you control|whenever you create (?:a|one or more|or sacrifice a) tokens?|whenever (?:a|one or more|another) (?:creature )?tokens? (?:you control )?enters|if (?:an effect|you) would create one or more tokens|twice that many|number of creatures you control|whenever one or more creatures you control (?:attack|deal)/),
    explain: (e, p) => `${list(e)} put bodies on the board; ${list(p)} pay off for going wide.`,
  },
  {
    id: "counters",
    name: "+1/+1 Counters",
    description: "Put +1/+1 counters on creatures and reward it.",
    enabler: re(/put (?:a|one|two|three|x|that many|an additional) \+1\/\+1 counters?|enters with (?:a|one|two|three|x) (?:additional )?\+1\/\+1 counters?|\bproliferate\b/),
    payoff: re(/whenever one or more \+1\/\+1 counters|with (?:a|one or more) \+1\/\+1 counters? on (?:it|them)|creature you control with a \+1\/\+1 counter|twice that many \+1\/\+1 counters|number of \+1\/\+1 counters|\bproliferate\b/),
    explain: (e, p) => `${list(e)} add +1/+1 counters that ${list(p)} key off of.`,
  },
  {
    id: "lifegain",
    name: "Lifegain",
    description: "Gain life repeatedly and turn it into advantage.",
    enabler: (c, t) =>
      hasKeyword(c, "Lifelink") ||
      /\blifelink\b|you gain (?:\d+|x|that much|life equal)|gains? \d+ life|create[^.]*food tokens?/.test(t),
    payoff: re(/whenever you gain life|if you (?:have )?gained (?:\d+|three|3) or more life|if you gained life this turn|life total|you gained life this turn|for each 1 life you gained|whenever you gain one or more life/),
    explain: (e, p) =>
      `${list(e)} gain life, and every instance triggers ${list(p)}. Several small gains per turn beat one big one.`,
    payoffWeight: 1.6,
  },
  {
    id: "aristocrats",
    name: "Aristocrats",
    description: "Sacrifice creatures and drain opponents with death triggers.",
    enabler: re(/sacrifice (?:a|an|another|one or more|any number of) (?:other )?(?:creature|nontoken creature|permanent)s?[^:.]*:|create[^.]*creature tokens?/),
    payoff: re(/whenever (?:a|another|one or more)(?: other)?(?: nontoken)? creatures?(?: you control)? (?:dies|die)|whenever you sacrifice (?:a|another|one or more) (?:creature|permanent)/),
    explain: (e, p) =>
      `${list(e)} provide fodder or free sacrifice, and every creature that dies triggers ${list(p)}.`,
    payoffWeight: 1.6,
  },
  {
    id: "sacrifice",
    name: "Sacrifice",
    description: "Repeatable sacrifice outlets that turn permanents into value.",
    enabler: re(/sacrifice (?:a|an|another|one or more|any number of|x) (?:other )?(?:creature|permanent|artifact|token|nontoken|food|treasure|clue)s?[^:.]*:/),
    payoff: re(/whenever you (?:create or )?sacrifice|whenever (?:a|another|one or more) (?:other )?(?:creature|permanent|artifact)s? (?:you control )?(?:dies|die|is put into a graveyard)/),
    explain: (e, p) => `${list(e)} are sacrifice outlets; ${list(p)} trigger when you use them.`,
  },
  {
    id: "graveyard",
    name: "Graveyard",
    description: "Fill the graveyard and get value back out of it.",
    enabler: re(/\bmill\b|\bsurveil\b|put the top [^.]*into your graveyard|discard (?:a|two|x) cards?|\bdredge\b/),
    payoff: re(/from your graveyard (?:to|onto)|cards? in your graveyard|\bflashback\b|\bunearth\b|\bescape\b|\bdelirium\b|\bthreshold\b|cast [^.]*from your graveyard/),
    explain: (e, p) => `${list(e)} stock the graveyard for ${list(p)} to use.`,
  },
  {
    id: "spellslinger",
    name: "Spellslinger",
    description: "Cast lots of instants and sorceries and reward it.",
    enabler: (c) => hasType(c, "Instant") || hasType(c, "Sorcery"),
    payoff: re(/whenever you cast (?:an instant or sorcery|a noncreature|your second) spell|instant and sorcery spells you control|\bmagecraft\b|\bprowess\b/),
    explain: (e, p) => `${list(p)} trigger off the ${e.length} instants and sorceries in the deck.`,
    payoffWeight: 2,
  },
  {
    id: "equipment",
    name: "Equipment",
    description: "Suit up creatures with Equipment.",
    enabler: (c) => /\bEquipment\b/.test(c.typeLine),
    payoff: re(/equipped creatures? you control|whenever [^.]*becomes equipped|equip abilities you activate cost|attach (?:target|an|all) equipment|for each equipment/),
    explain: (e, p) => `${list(p)} make ${list(e)} cheaper or stronger.`,
    payoffWeight: 2,
  },
  {
    id: "enchantments",
    name: "Enchantments",
    description: "Play many enchantments and reward each one.",
    enabler: (c) => hasType(c, "Enchantment"),
    payoff: re(/whenever you cast an enchantment spell|whenever (?:an|another) enchantment (?:you control )?enters|\bconstellation\b|for each enchantment you control|enchantments? you control (?:have|get)/),
    explain: (e, p) => `${list(p)} trigger off the ${e.length} enchantments in the deck.`,
    payoffWeight: 2,
  },
  {
    id: "landfall",
    name: "Landfall",
    description: "Put extra lands onto the battlefield to trigger landfall.",
    enabler: re(/search your library for [^.]*lands?[^.]*onto the battlefield|you may play (?:an )?additional lands?|put (?:a|up to \w+) land cards? from your hand onto the battlefield|return [^.]*land[^.]*from your graveyard to the battlefield/),
    payoff: re(/\blandfall\b|whenever a land (?:you control )?enters|whenever one or more lands (?:you control )?enter/),
    explain: (e, p) => `${list(e)} drop extra lands, each one triggering ${list(p)}.`,
    payoffWeight: 2,
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
