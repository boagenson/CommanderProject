/**
 * Deck Doctor: composes a structured report from the individual analyzers.
 * Each section is built by a small function so the UI can consume parts
 * independently and tests can target one heuristic at a time. Language is
 * deliberately tentative ("potential concern", "consider testing") because
 * Commander deckbuilding is contextual and the heuristics read card text only.
 */
import type { Deck, DeckAnalysis, DeckDoctorReport, DeckIntent, DetectedStrategy, DoctorFinding, FunctionalCategory, StrategyName } from "@/lib/types";
import { DEFAULT_INTENT } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { CATEGORY_TARGETS } from "@/lib/upgrade/context";
import { describeCommanderStrategy, detectStrategies, STRATEGY_DESCRIPTIONS } from "./strategy";

/** Roles that justify a card's slot regardless of theme. */
export const UTILITY_ROLES: FunctionalCategory[] = [
  "Ramp",
  "Mana Fixing",
  "Card Draw",
  "Card Advantage",
  "Targeted Removal",
  "Board Wipes",
  "Counterspells",
  "Protection",
  "Tutors",
  "Graveyard Recursion",
];

const ROLE_NOTES: Partial<Record<FunctionalCategory, string>> = {
  Ramp: "Ramp lets you cast your commander on curve and double-spell in the mid game.",
  "Card Draw": "Card draw keeps the engine fed after the opening hand runs out.",
  "Targeted Removal": "Targeted removal answers the one permanent that would otherwise beat you.",
  "Board Wipes": "Board wipes reset games you are losing; go-wide decks often skip them on purpose.",
  Protection: "Protection keeps a key engine or commander alive through removal.",
  "Graveyard Recursion": "Recursion turns removal on your engine pieces into a delay instead of a loss.",
  Tutors: "Tutors make a package show up reliably instead of occasionally.",
  Finishers: "Finishers convert an advantage into an actual win.",
};

export function roleCoverage(analysis: DeckAnalysis): DeckDoctorReport["roleCoverage"] {
  const roles: FunctionalCategory[] = ["Ramp", "Card Draw", "Targeted Removal", "Board Wipes", "Protection", "Graveyard Recursion", "Tutors", "Finishers"];
  return roles.map((role) => {
    const cards = analysis.categories[role];
    const target = CATEGORY_TARGETS[role] ?? 3;
    const count = cards.length;
    const note =
      count < target * 0.6
        ? `The deck currently has relatively few cards classified as ${role} (${count}; many decks run around ${target}). ${ROLE_NOTES[role] ?? ""}`.trim()
        : count > target * 1.8
          ? `Well above the typical count for ${role} (${count} vs. about ${target}). That is a deliberate choice in some builds; otherwise a slot or two could support the main plan.`
          : `${count} cards classified as ${role}, in the usual range.`;
    return { role, count, target, cards, note };
  });
}

export function strengths(analysis: DeckAnalysis, primary: DetectedStrategy | null): DoctorFinding[] {
  const out: DoctorFinding[] = [];
  for (const cov of roleCoverage(analysis)) {
    if (cov.count >= cov.target * 1.2 && cov.role !== "Finishers") {
      out.push({ id: `strength-${cov.role}`, title: `Solid ${cov.role.toLowerCase()} count`, detail: `${cov.count} cards, comfortably above the ~${cov.target} many decks aim for.`, cards: cov.cards });
    }
  }
  for (const pkg of analysis.packages.slice(0, 3)) {
    if (pkg.strength >= 40 && pkg.enablers.length >= 2 && pkg.payoffs.length >= 1) {
      out.push({ id: `strength-pkg-${pkg.id}`, title: `${pkg.name} looks well supported`, detail: `${pkg.enablers.length} enablers and ${pkg.payoffs.length} payoffs. ${pkg.purpose}`, cards: [...pkg.payoffs, ...pkg.enablers].slice(0, 8) });
    }
  }
  const infinite = analysis.combos.filter((c) => c.type === "infinite");
  if (infinite.length) out.push({ id: "strength-combo", title: "Has a known infinite combo", detail: infinite.map((c) => c.definition.name).join("; "), cards: infinite.flatMap((c) => c.present) });
  const engines = analysis.combos.filter((c) => c.type === "engine");
  if (engines.length) out.push({ id: "strength-engines", title: `${engines.length} named value engine${engines.length === 1 ? "" : "s"}`, detail: engines.map((c) => c.definition.name).join("; "), cards: engines.flatMap((c) => c.present) });
  if (analysis.mana.concerns.length === 0 && analysis.landCount) out.push({ id: "strength-mana", title: "Mana base has no obvious color gaps", detail: "Colored sources roughly match colored pip requirements." });
  if (primary && primary.score >= 50) out.push({ id: "strength-focus", title: `Clear ${primary.name} focus`, detail: primary.explanation });
  if (analysis.averageManaValue <= 3.2 && analysis.nonlandCount) out.push({ id: "strength-curve", title: "Low mana curve", detail: `Average mana value ${analysis.averageManaValue.toFixed(2)} keeps early turns active.` });
  return out;
}

export function weaknesses(analysis: DeckAnalysis, primary: DetectedStrategy | null): DoctorFinding[] {
  const out: DoctorFinding[] = [];
  for (const cov of roleCoverage(analysis)) {
    if (cov.count < cov.target * 0.6 && cov.role !== "Tutors" && cov.role !== "Graveyard Recursion") {
      out.push({ id: `weak-${cov.role}`, title: `Potential concern: light on ${cov.role.toLowerCase()}`, detail: cov.note, cards: cov.cards, severity: cov.role === "Board Wipes" ? "info" : "warning" });
    }
  }
  if (analysis.winConditions.unclear) {
    out.push({ id: "weak-wincon", title: "No clear finishing plan detected", detail: analysis.winConditions.note, severity: "warning" });
  }
  if (analysis.averageManaValue > 3.7 && analysis.categories.Ramp.length < 10) {
    out.push({ id: "weak-curve", title: "Potential concern: high curve with modest ramp", detail: `Average mana value ${analysis.averageManaValue.toFixed(2)} with ${analysis.categories.Ramp.length} ramp pieces. Consider testing whether hands feel slow before turn four.`, severity: "warning" });
  }
  if (primary && primary.score < 35) {
    out.push({ id: "weak-focus", title: "Themes are spread thin", detail: `The strongest detected strategy (${primary.name}) scores only ${primary.score}. The deck may be doing several things at once; that can be fine for a casual table but tends to reduce consistency.`, severity: "info" });
  }
  const protection = analysis.categories.Protection.length;
  const voltron = analysis.winConditions.conditions.find((c) => c.type === "Commander damage");
  if (voltron && voltron.strength >= 35 && protection < 4) {
    out.push({ id: "weak-voltron-protection", title: "Commander-damage plan with little protection", detail: `${protection} protection effects. A Voltron plan usually wants several ways to keep the commander on the battlefield.`, severity: "warning" });
  }
  return out;
}

export function manaConcerns(analysis: DeckAnalysis): DoctorFinding[] {
  return analysis.mana.concerns.map((c) => ({ id: c.id, title: c.title, detail: c.detail, cards: c.cards, severity: c.severity }));
}

/**
 * Cards that appear poorly connected: nonland, no utility role, and little or
 * no presence in the synergy graph or the top themes. Connection is a 0–100
 * score; only the lowest few are reported and the wording stays tentative.
 */
export function disconnectedCards(deck: Deck, analysis: DeckAnalysis, limit = 8): DeckDoctorReport["disconnected"] {
  const commanders = new Set(deck.commanders.map((c) => c.card.name));
  const topThemes = new Set(analysis.themes.slice(0, 3).map((t) => t.id));
  const themeMembers = new Map<string, number>();
  for (const t of analysis.themes) for (const c of t.cards) themeMembers.set(c.name, (themeMembers.get(c.name) ?? 0) + (topThemes.has(t.id) ? 2 : 1));
  const degree = new Map(analysis.graph.nodes.map((n) => [n.name, n.degree]));
  const out: DeckDoctorReport["disconnected"] = [];
  for (const dc of deck.cards) {
    if ((dc.board ?? "main") !== "main" || isLand(dc.card) || commanders.has(dc.card.name)) continue;
    const roles = analysis.cardCategories[dc.card.name]?.categories ?? [];
    if (roles.some((r) => UTILITY_ROLES.includes(r))) continue;
    // Degree is a sum of edge weights (a strong relationship ≈ 2); four solid links read as well connected.
    const connection = Math.min(100, Math.round((degree.get(dc.card.name) ?? 0) * 4 + (themeMembers.get(dc.card.name) ?? 0) * 10));
    if (connection >= 30) continue;
    const note = connection === 0
      ? "This card appears less connected to the deck's primary themes and has no detected utility role. It may be here for flavor, as a standalone threat, or for a reason the heuristics can't read."
      : "This card appears only loosely connected to the deck's primary themes. Consider testing whether it pulls its weight, or mark it Favorite / Flavor Essential if it stays on purpose.";
    out.push({ name: dc.card.name, connection, note });
  }
  return out.sort((a, b) => a.connection - b.connection).slice(0, limit);
}

function gamePlan(primary: DetectedStrategy | null, secondary: DetectedStrategy[], analysis: DeckAnalysis): string {
  const win = analysis.winConditions.conditions.filter((c) => c.strength >= 35).slice(0, 2);
  const early = analysis.averageManaValue <= 3.2 ? "curve out early" : analysis.categories.Ramp.length >= 10 ? "ramp through the first turns" : "develop a board over the first few turns";
  const mid = primary ? `assemble the ${primary.name} package${secondary.length ? ` with ${secondary.map((s) => s.name).join(" and ")} as support` : ""}` : "build value with whatever engines stick";
  const late = win.length ? `then close through ${win.map((w) => w.type.toLowerCase()).join(" or ")}` : "then look for a way to convert the advantage into a win, which the deck does not make obvious yet";
  return `Likely plan: ${early}, ${mid}, ${late}. This is inferred from card text and may not match how the deck plays at your table.`;
}

function intentNotes(intent: DeckIntent, detected: DetectedStrategy[]): string[] {
  const notes: string[] = [];
  const byName = new Map(detected.map((d) => [d.name, d]));
  if (intent.primaryStrategy) {
    const d = byName.get(intent.primaryStrategy);
    if (!d) notes.push(`You chose ${intent.primaryStrategy} as the primary strategy, but the cards currently show little support for it. Recommendations will favor cards that build toward it.`);
    else if (detected[0] && detected[0].name !== intent.primaryStrategy && detected[0].score > d.score + 15) notes.push(`The cards lean ${detected[0].name} (${detected[0].score}) more than ${intent.primaryStrategy} (${d.score}). Both are respected; recommendations weight your choice first.`);
  }
  for (const s of intent.secondaryStrategies) {
    if (!byName.get(s)) notes.push(`Secondary strategy ${s} has little detected support yet.`);
  }
  return notes;
}

export function buildDoctorReport(deck: Deck, analysis: DeckAnalysis, intentOverride?: DeckIntent): DeckDoctorReport {
  const intent = intentOverride ?? deck.intent ?? DEFAULT_INTENT;
  const roles = new Map(Object.values(analysis.cardCategories).map((c) => [c.name, c.categories]));
  const tags = new Map(Object.values(analysis.cardCategories).map((c) => [c.name, c.tags.map((t) => t.value)]));
  const commanders = deck.commanders.map((c) => c.card);
  const cards = deck.cards.filter((c) => (c.board ?? "main") === "main").map((c) => c.card);
  const detected = detectStrategies({ commanders, cards, themes: analysis.themes, roles, combos: analysis.combos }).filter(
    (d) => !intent.dismissedStrategies?.includes(d.name),
  );

  const primary = intent.primaryStrategy
    ? detected.find((d) => d.name === intent.primaryStrategy) ?? { name: intent.primaryStrategy, score: 0, themes: [], explanation: STRATEGY_DESCRIPTIONS[intent.primaryStrategy] }
    : detected[0] ?? null;
  const secondaryNames = new Set<StrategyName>(intent.secondaryStrategies);
  const secondary = [
    ...intent.secondaryStrategies.map((n) => detected.find((d) => d.name === n) ?? { name: n, score: 0, themes: [], explanation: STRATEGY_DESCRIPTIONS[n] }),
    ...detected.filter((d) => d.name !== primary?.name && !secondaryNames.has(d.name) && d.score >= 25).slice(0, 3),
  ];

  return {
    commanderStrategy: describeCommanderStrategy(commanders, roles, tags),
    archetypes: detected,
    primary,
    secondary,
    gamePlan: gamePlan(primary, secondary.slice(0, 2), analysis),
    strengths: strengths(analysis, primary),
    weaknesses: weaknesses(analysis, primary),
    manaConcerns: manaConcerns(analysis),
    roleCoverage: roleCoverage(analysis),
    winConditions: analysis.winConditions,
    packages: analysis.packages,
    combos: analysis.combos,
    disconnected: disconnectedCards(deck, analysis),
    intentNotes: intentNotes(intent, detected),
  };
}

export { detectStrategies, STRATEGY_DESCRIPTIONS } from "./strategy";
