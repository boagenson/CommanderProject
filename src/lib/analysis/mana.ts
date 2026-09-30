/**
 * Mana Base Doctor: compares colored mana demand against production and
 * breaks sources down by kind. Pure and independent of React.
 *
 * Handling of tricky cases:
 * - Hybrid pips ({W/B}) count half toward each color; Phyrexian ({B/P}) counts
 *   as the color (see `countPips`).
 * - {C} pips are tracked separately as a colorless requirement.
 * - Modal double-faced cards with a land back face ("Sorcery // Land") count
 *   as a partial land source (`MDFC_LAND_WEIGHT`) since they are usually cast
 *   as spells when possible.
 * - Lands with several colors count once per color they produce.
 * - Fetch-style lands with no `produced_mana` are credited with the deck's
 *   identity colors.
 * - Sources are only counted for colors inside the commander's identity.
 */
import type { Card, Color, ColorDemand, HealthDiagnostic, ManaColor, ManaReport, ManaSourceBreakdown } from "@/lib/types";
import { COLORS } from "@/lib/types";
import { COLOR_NAMES, countPips, hasType, isBasicLand, isLand } from "@/lib/cards/helpers";
import { rulesText } from "./text";

export const MANA_THRESHOLDS = {
  /** Pip share minus source share that is worth mentioning. */
  colorGap: 0.12,
  /** Fewer land sources than this for a color with heavy (2+) pips is a note. */
  heavyColorLands: 10,
  /** Tapped-land share above this slows early turns noticeably. */
  tappedShare: 0.4,
  mdfcLandWeight: 0.5,
};

const emptyColors = (): Record<Color, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0 });

export function hasLandBackFace(card: Card) {
  if (!card.faces || card.faces.length < 2) return false;
  return !/\bLand\b/.test(card.faces[0].typeLine) && /\bLand\b/.test(card.faces[1].typeLine);
}

/** Colors a land (or land face) can produce, crediting fetches with the identity. */
export function landColors(card: Card, identity: Color[]): ManaColor[] {
  const produced = card.producedMana.length
    ? card.producedMana
    : /search your library for [^.]*(?:basic )?land/i.test(card.oracleText)
      ? identity
      : [];
  return [...new Set(produced)];
}

/** Does this land usually enter tapped? Conditional lands (checklands, shocks) are "sometimes". */
export function landEntersTapped(card: Card): "yes" | "no" | "sometimes" {
  const t = rulesText(card);
  if (/~ enters(?: the battlefield)? tapped unless|enters(?: the battlefield)? tapped unless|you may pay 2 life\. if you don't, it enters(?: the battlefield)? tapped|enters(?: the battlefield)? tapped(?: unless)?[^.]*(?:two or more|three or more|if you control)/.test(t)) return "sometimes";
  if (/~ enters(?: the battlefield)? tapped\b|enters(?: the battlefield)? tapped\./.test(t)) return "yes";
  return "no";
}

function isManaRock(card: Card, t: string) {
  return !isLand(card) && hasType(card, "Artifact") && !hasType(card, "Creature") && /\{t\}[^:]*: add/.test(t);
}
function isManaDork(card: Card, t: string) {
  return hasType(card, "Creature") && /\{t\}[^:]*: add|^add \{|\n\{t\}: add/.test(t);
}
function isLandRamp(t: string) {
  return /search your library for [^.]*\b(?:lands?|forest|plains|island|swamp|mountain)\b[^.]*cards?[^.]*onto the battlefield|put (?:a|up to \w+) land cards? from your hand onto the battlefield|you may play (?:an )?additional lands?/.test(t);
}
function makesTreasure(t: string) {
  return /create (?:a|one|two|three|x|that many) (?:tapped )?treasure tokens?|create[^.]*treasure token/.test(t);
}
function reducesCosts(t: string) {
  return /(?:spells?|abilities|creature spells|artifact spells|instant and sorcery spells)[^.]* cost \{?\w\}? less|costs? \{\d\} less to (?:cast|activate)/.test(t);
}

/** Full mana report for an expanded card list (quantities applied). */
export function analyzeMana(cards: Card[], identity: Color[]): ManaReport {
  const pips = emptyColors();
  const pipCards = emptyColors();
  const heavyCards = emptyColors();
  const sources = emptyColors();
  const landSources = emptyColors();
  const untappedLandSources = emptyColors();
  let colorlessPips = 0;
  let genericPips = 0;
  let landCount = 0;
  const breakdown: ManaSourceBreakdown = {
    lands: 0, untappedLands: 0, tappedLands: 0, conditionalLands: 0, manaRocks: 0, manaDorks: 0, landRamp: 0, treasureMakers: 0, costReducers: 0, fixers: 0, mdfcLands: 0,
  };
  const inIdentity = (c: ManaColor): c is Color => c !== "C" && identity.includes(c);

  for (const card of cards) {
    const t = rulesText(card);
    if (isLand(card)) {
      landCount++;
      breakdown.lands++;
      const tapped = landEntersTapped(card);
      if (tapped === "yes") breakdown.tappedLands++;
      else if (tapped === "sometimes") breakdown.conditionalLands++;
      else breakdown.untappedLands++;
      for (const c of landColors(card, identity)) {
        if (!inIdentity(c)) continue;
        sources[c]++;
        landSources[c]++;
        if (tapped !== "yes") untappedLandSources[c]++;
      }
      continue;
    }

    // Spell side: demand.
    const p = countPips(card.manaCost);
    for (const c of COLORS) {
      pips[c] += p[c];
      if (p[c] > 0) pipCards[c]++;
      if (p[c] >= 2) heavyCards[c]++;
    }
    colorlessPips += p.C;
    genericPips += p.generic;

    // MDFC land back face: partial land source.
    if (hasLandBackFace(card)) {
      breakdown.mdfcLands++;
      const back = card.faces![1];
      const backColors = [...back.oracleText.matchAll(/\{([WUBRG])\}/g)].map((m) => m[1] as Color);
      for (const c of new Set(backColors.length ? backColors : card.colorIdentity)) {
        if (!identity.includes(c)) continue;
        sources[c] += MANA_THRESHOLDS.mdfcLandWeight;
      }
    }

    // Nonland production.
    const produced = new Set(card.producedMana.filter(inIdentity));
    if (isManaRock(card, t)) breakdown.manaRocks++;
    else if (isManaDork(card, t)) breakdown.manaDorks++;
    if (isLandRamp(t)) breakdown.landRamp++;
    if (makesTreasure(t)) breakdown.treasureMakers++;
    if (reducesCosts(t)) breakdown.costReducers++;
    if (produced.size >= 2) breakdown.fixers++;
    for (const c of produced) sources[c]++;
  }

  const totalPips = COLORS.reduce((n, c) => n + pips[c], 0);
  const totalSources = COLORS.reduce((n, c) => n + sources[c], 0);
  const demand: ColorDemand[] = COLORS.filter((c) => identity.includes(c)).map((color) => {
    const pipShare = totalPips ? pips[color] / totalPips : 0;
    const sourceShare = totalSources ? sources[color] / totalSources : 0;
    return {
      color,
      pips: round1(pips[color]),
      cards: pipCards[color],
      heavyCards: heavyCards[color],
      pipShare,
      sourceShare,
      sources: round1(sources[color]),
      landSources: landSources[color],
      untappedLandSources: untappedLandSources[color],
      gap: pipShare - sourceShare,
    };
  });

  const rampCount = breakdown.manaRocks + breakdown.manaDorks + breakdown.landRamp + breakdown.treasureMakers;
  const nonland = cards.filter((c) => !isLand(c));
  const avg = nonland.length ? nonland.reduce((n, c) => n + c.cmc, 0) / nonland.length : 0;
  const suggestedLands = suggestLandRange(avg, rampCount, breakdown.mdfcLands);

  const concerns: HealthDiagnostic[] = [];
  const notes: string[] = [];

  for (const d of demand) {
    if (d.gap > MANA_THRESHOLDS.colorGap && d.pips > 0) {
      concerns.push({
        id: `mana-color-${d.color}`,
        severity: d.gap > MANA_THRESHOLDS.colorGap * 2 ? "warning" : "info",
        title: `${COLOR_NAMES[d.color]} may be under-supplied`,
        detail: `${COLOR_NAMES[d.color]} represents approximately ${pct(d.pipShare)} of your colored pip requirements but only ${pct(d.sourceShare)} of your identified colored mana sources (${d.landSources} lands, ${d.sources} total). Consider testing whether ${COLOR_NAMES[d.color].toLowerCase()} spells get stuck in hand.`,
      });
    }
    if (d.heavyCards > 0 && d.landSources < MANA_THRESHOLDS.heavyColorLands && identity.length > 1) {
      concerns.push({
        id: `mana-heavy-${d.color}`,
        severity: "info",
        title: `${d.heavyCards} card${d.heavyCards === 1 ? "" : "s"} need${d.heavyCards === 1 ? "s" : ""} two or more ${COLOR_NAMES[d.color].toLowerCase()} pips`,
        detail: `Only ${d.landSources} lands produce ${COLOR_NAMES[d.color].toLowerCase()}. Double-pip cards are the ones most often stranded when a color runs short.`,
      });
    }
  }

  if (landCount && landCount < suggestedLands.low) {
    concerns.push({
      id: "mana-few-lands",
      severity: "warning",
      title: "Land count looks light for this curve",
      detail: `${landCount} lands with ${rampCount} nonland ramp pieces and an average mana value of ${avg.toFixed(2)}. A range of ${suggestedLands.low}–${suggestedLands.high} is more typical; the opening-hand simulator can show how often this deck keeps two or fewer lands.`,
    });
  } else if (landCount > suggestedLands.high + 2) {
    concerns.push({
      id: "mana-many-lands",
      severity: "info",
      title: "Land count is on the high side",
      detail: `${landCount} lands. That is reasonable for landfall or land-light-ramp decks; otherwise a couple could become spells.`,
    });
  }

  const tappedShare = landCount ? breakdown.tappedLands / landCount : 0;
  if (tappedShare > MANA_THRESHOLDS.tappedShare) {
    concerns.push({
      id: "mana-tapped",
      severity: "info",
      title: "Many lands enter tapped",
      detail: `${breakdown.tappedLands} of ${landCount} lands always enter tapped (${pct(tappedShare)}). That is a fair trade for color fixing on a budget, but it slows the first three turns.`,
    });
  }

  if (colorlessPips > 0) notes.push(`${colorlessPips} pip${colorlessPips === 1 ? "" : "s"} require colorless mana ({C}) specifically; ${cards.filter((c) => c.producedMana.includes("C")).length} sources can produce it.`);
  if (breakdown.mdfcLands) notes.push(`${breakdown.mdfcLands} modal double-faced card${breakdown.mdfcLands === 1 ? "" : "s"} with a land face count as half a land source each.`);
  if (breakdown.fixers) notes.push(`${breakdown.fixers} nonland card${breakdown.fixers === 1 ? "" : "s"} produce two or more of your colors.`);
  if (!identity.length) notes.push("No commander colors yet, so colored demand can't be compared with production.");

  return {
    landCount,
    suggestedLands,
    colorlessPips,
    genericPips,
    demand,
    breakdown,
    rampCount,
    concerns,
    notes,
  };
}

/**
 * A rough land range: start from 37, add for a high curve, subtract for
 * cheap ramp and MDFCs. Guidance rather than a rule.
 */
export function suggestLandRange(averageManaValue: number, rampCount: number, mdfcLands = 0) {
  let base = 37;
  if (averageManaValue > 3.6) base += 1;
  if (averageManaValue > 4) base += 1;
  if (averageManaValue < 2.8) base -= 1;
  base -= Math.min(3, Math.floor(rampCount / 5));
  base -= Math.floor(mdfcLands / 2);
  return { low: Math.max(30, base - 2), high: Math.min(42, base + 1) };
}

/** Mana requirements of a single spell as a readable list, e.g. "1 W, 2 B". */
export function describePips(card: Card) {
  if (isLand(card)) return "Land";
  const p = countPips(card.manaCost);
  const parts = COLORS.filter((c) => p[c] > 0).map((c) => `${round1(p[c])} ${c}`);
  if (p.C) parts.push(`${p.C} C`);
  if (p.generic) parts.push(`${p.generic} generic`);
  return parts.join(", ") || "Free";
}

export function isBasic(card: Card) {
  return isBasicLand(card);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;
