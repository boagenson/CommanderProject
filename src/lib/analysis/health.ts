/**
 * Deck Health diagnostics. These are guidelines drawn from common Commander
 * deckbuilding advice, not rules: thresholds are gathered in `HEALTH_THRESHOLDS`
 * so they're easy to tune, and messages are phrased as suggestions.
 */
import type { DeckAnalysis, FunctionalCategory, HealthDiagnostic, ValidationIssue } from "@/lib/types";
import { COLOR_NAMES } from "@/lib/cards/helpers";

export const HEALTH_THRESHOLDS = {
  lands: { low: 33, high: 42 },
  ramp: 8,
  draw: 8,
  interaction: 8,
  wipes: 1,
  avgManaValue: 3.6,
  /** Pip share minus source share that warrants a note. */
  colorGap: 0.15,
};

type Input = Pick<DeckAnalysis, "landCount" | "averageManaValue" | "manaProduction" | "categories" | "nonlandCount"> & {
  validation: ValidationIssue[];
};

const count = (cats: Record<FunctionalCategory, string[]>, c: FunctionalCategory) => cats[c].length;

export function deckHealth(a: Input): HealthDiagnostic[] {
  const out: HealthDiagnostic[] = [];
  const t = HEALTH_THRESHOLDS;

  // Rules problems surface first, as they block legal play.
  for (const v of a.validation) {
    if (v.code === "no-commander") continue;
    const titles: Record<string, string> = {
      "color-identity": "Cards outside color identity",
      illegal: "Illegal cards",
      singleton: "Duplicate singleton cards",
      unresolved: "Unresolved cards",
      "deck-size": "Deck size",
      "invalid-partners": "Commander pairing",
      "invalid-commander": "Commander eligibility",
      "too-many-commanders": "Too many commanders",
      "background-alone": "Background without a commander",
    };
    out.push({ id: `rule-${v.code}`, severity: v.severity, title: titles[v.code] ?? "Rules issue", detail: v.message, cards: v.cards });
  }

  if (a.landCount < t.lands.low) {
    out.push({
      id: "low-lands",
      severity: "warning",
      title: "Land count looks low",
      detail: `${a.landCount} lands. Many Commander decks run ${t.lands.low}–38, fewer if they have lots of cheap ramp and draw.`,
    });
  } else if (a.landCount > t.lands.high) {
    out.push({
      id: "high-lands",
      severity: "info",
      title: "Land count is high",
      detail: `${a.landCount} lands. That's fine for landfall decks; otherwise a few could become spells.`,
    });
  }

  const ramp = count(a.categories, "Ramp");
  if (ramp < t.ramp) {
    out.push({ id: "low-ramp", severity: "warning", title: "Light on ramp", detail: `${ramp} ramp pieces. Around ${t.ramp}–12 helps you cast your commander on curve and keep up.` });
  }
  const draw = count(a.categories, "Card Draw");
  if (draw < t.draw) {
    out.push({ id: "low-draw", severity: "warning", title: "Limited card draw", detail: `${draw} card draw sources. Around ${t.draw}–12 helps avoid running out of gas.` });
  }
  const interaction = count(a.categories, "Targeted Removal") + count(a.categories, "Counterspells");
  if (interaction < t.interaction) {
    out.push({ id: "low-interaction", severity: "warning", title: "Limited interaction", detail: `${interaction} targeted removal or counterspells. Around ${t.interaction}–10 lets you answer opposing threats.` });
  }
  const wipes = count(a.categories, "Board Wipes");
  if (wipes < t.wipes) {
    out.push({ id: "no-wipes", severity: "info", title: "No board wipes", detail: "A wipe or two can reset games you're behind in. Go-wide decks often skip them deliberately." });
  }
  if (a.averageManaValue > t.avgManaValue) {
    out.push({ id: "high-mv", severity: "warning", title: "High average mana value", detail: `Average mana value is ${a.averageManaValue.toFixed(2)}. Consider more ramp or cheaper spells to keep early turns active.` });
  }

  for (const m of a.manaProduction.mismatches) {
    const gap = m.pipShare - m.sourceShare;
    if (gap > t.colorGap) {
      out.push({
        id: `color-${m.color}`,
        severity: "warning",
        title: `${COLOR_NAMES[m.color]} sources may be short`,
        detail: `${Math.round(m.pipShare * 100)}% of colored pips are ${COLOR_NAMES[m.color]}, but only ${Math.round(m.sourceShare * 100)}% of colored mana sources produce it.`,
      });
    }
  }

  if (!out.length) {
    out.push({ id: "healthy", severity: "info", title: "Looks well-rounded", detail: "No obvious gaps against common Commander guidelines." });
  }
  return out;
}
