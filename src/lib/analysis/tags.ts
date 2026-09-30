/**
 * Thematic tags: which mechanics a card touches (Food, Treasure, sacrifice,
 * death triggers…), independent of whether it enables or rewards them.
 * Roles (`categories.ts`) say what a card *does for the deck*; tags say what
 * it *cares about*. Both are detected from rules text and types, never names.
 */
import type { Card, Classification, Commander, DeckCard, ThematicTag } from "@/lib/types";
import { hasType, isLand, isLegendary } from "@/lib/cards/helpers";
import { DEATH_TRIGGER, hasKeyword, rulesText } from "./text";

export interface TagRule {
  tag: ThematicTag;
  test: (card: Card, text: string) => { reason: string; confidence: number } | null;
}

const re = (pattern: RegExp, reason: string, confidence = 0.85): TagRule["test"] =>
  (_c, t) => (pattern.test(t) ? { reason, confidence } : null);

const tokenKind = (kind: string, subtype: string): TagRule["test"] => (card, t) => {
  if (new RegExp(`\\b${subtype}\\b`).test(card.typeLine)) return { reason: `Is a ${subtype}`, confidence: 0.95 };
  if (new RegExp(`\\b${kind}s?\\b`).test(t) || (kind === "clue" && /\binvestigate\b/.test(t))) return { reason: `Mentions ${subtype}`, confidence: 0.9 };
  return null;
};

export const TAG_RULES: TagRule[] = [
  { tag: "Food", test: tokenKind("food", "Food") },
  { tag: "Treasure", test: tokenKind("treasure", "Treasure") },
  { tag: "Clue", test: tokenKind("clue", "Clue") },
  {
    tag: "Artifact",
    test: (card, t) => {
      if (hasType(card, "Artifact") && !isLand(card)) return { reason: "Is an artifact", confidence: 0.95 };
      if (/\bartifacts?\b/.test(t) && !/artifact creature token/.test(t)) return { reason: "Cares about artifacts", confidence: 0.8 };
      if (/\b(?:food|treasure|clue|blood|map|powerstone)\b/.test(t)) return { reason: "Makes or uses artifact tokens", confidence: 0.6 };
      return null;
    },
  },
  { tag: "Token", test: re(/\btokens?\b/, "Mentions tokens", 0.85) },
  {
    tag: "Lifegain",
    test: (card, t) => {
      if (hasKeyword(card, "Lifelink") || /\blifelink\b/.test(t)) return { reason: "Lifelink", confidence: 0.9 };
      if (/you gain (?:\d+|x|that much|life)|gain life|gained (?:\d+ or more )?life|whenever you gain life|life total/.test(t)) return { reason: "Gains life or cares about it", confidence: 0.85 };
      if (/\bfood\b/.test(t)) return { reason: "Food gains life", confidence: 0.5 };
      return null;
    },
  },
  { tag: "Sacrifice", test: re(/\bsacrifice\b/, "Sacrifices or cares about sacrifice", 0.85) },
  {
    tag: "Death Trigger",
    test: (_c, t) =>
      DEATH_TRIGGER.test(t) || /when ~ dies|whenever [^.]* dies|is put into a graveyard from the battlefield/.test(t)
        ? { reason: "Triggers on death", confidence: 0.9 }
        : null,
  },
  {
    tag: "ETB",
    test: re(/when ~ enters|whenever (?:a|an|another|one or more) [^.]*enters(?: the battlefield)?(?: under your control)?/, "Enters-the-battlefield trigger", 0.85),
  },
  { tag: "Counters", test: re(/\+1\/\+1 counters?|\bproliferate\b|-1\/-1 counters?/, "Uses counters", 0.9) },
  { tag: "Graveyard", test: re(/\bgraveyard\b|\bmill\b|\bsurveil\b|\bflashback\b|\bunearth\b|\bescape\b/, "Uses the graveyard", 0.85) },
  {
    tag: "Equipment",
    test: (card, t) => (/\bEquipment\b/.test(card.typeLine) ? { reason: "Is Equipment", confidence: 0.95 } : /\bequip(?:ped|ment)\b/.test(t) ? { reason: "Cares about Equipment", confidence: 0.85 } : null),
  },
  { tag: "Landfall", test: re(/\blandfall\b|whenever a land (?:you control )?enters|search your library for [^.]*land[^.]*onto the battlefield|additional lands?/, "Land-based triggers or extra lands", 0.8) },
  {
    tag: "Enchantment",
    test: (card, t) => (hasType(card, "Enchantment") ? { reason: "Is an enchantment", confidence: 0.95 } : /\benchantments?\b|\bconstellation\b/.test(t) ? { reason: "Cares about enchantments", confidence: 0.8 } : null),
  },
  {
    tag: "Spells",
    test: (card, t) =>
      hasType(card, "Instant") || hasType(card, "Sorcery")
        ? { reason: "Instant or sorcery", confidence: 0.7 }
        : /instant (?:or|and) sorcery|noncreature spell|\bmagecraft\b|\bprowess\b|whenever you cast/.test(t)
          ? { reason: "Rewards casting spells", confidence: 0.85 }
          : null,
  },
  {
    tag: "Combat",
    test: (card, t) =>
      /whenever ~ attacks|attacks or blocks|additional combat|combat damage|creatures you control get \+|\bdouble strike\b|\btrample\b|\bmenace\b/.test(t) || hasKeyword(card, "Double strike")
        ? { reason: "Combat-oriented", confidence: 0.75 }
        : null,
  },
  {
    tag: "Legendary",
    test: (card, t) => (isLegendary(card) && !isLand(card) ? { reason: "Legendary permanent", confidence: 0.95 } : /\blegendary\b|\bhistoric\b/.test(t) ? { reason: "Cares about legendary/historic", confidence: 0.8 } : null),
  },
];

const tagCache = new WeakMap<Card, Classification<ThematicTag>[]>();

/** Detected tags for a card (memoized). */
export function classifyTags(card: Card): Classification<ThematicTag>[] {
  const hit = tagCache.get(card);
  if (hit) return hit;
  const text = rulesText(card);
  const out: Classification<ThematicTag>[] = [];
  for (const rule of TAG_RULES) {
    const res = rule.test(card, text);
    if (res) out.push({ value: rule.tag, reason: res.reason, confidence: res.confidence });
  }
  tagCache.set(card, out);
  return out;
}

type Taggable = Pick<DeckCard, "card" | "tagOverrides"> | Pick<Commander, "card" | "tagOverrides">;

/** Tags after applying the user's manual corrections. Manual wins. */
export function effectiveTags(dc: Taggable): Classification<ThematicTag>[] {
  const add = dc.tagOverrides?.add ?? [];
  const remove = new Set(dc.tagOverrides?.remove ?? []);
  const out: Classification<ThematicTag>[] = [];
  for (const m of classifyTags(dc.card)) {
    if (remove.has(m.value)) continue;
    const manual = add.includes(m.value);
    out.push({ ...m, confidence: manual ? 1 : m.confidence, reason: manual ? "Confirmed by you" : m.reason, manual });
  }
  for (const tag of add) {
    if (remove.has(tag) || out.some((o) => o.value === tag)) continue;
    out.push({ value: tag, confidence: 1, reason: "Set by you", manual: true });
  }
  return out;
}
