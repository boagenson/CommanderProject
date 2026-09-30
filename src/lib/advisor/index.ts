/**
 * DeckAdvisor: the seam for a future AI Deck Doctor.
 *
 * The UI asks an advisor for advice with a structured `DeckContext` (never
 * raw app state) and receives structured `AdvisorRecommendation`s. Today the
 * only implementation is `LocalDeckAdvisor`, which is deterministic and
 * builds its output from the Deck Doctor report. A server-side advisor can
 * later implement the same interface behind `/api/advisor`; API keys stay on
 * the server and the app keeps working when no service is configured.
 */
import type { Deck, DeckAnalysis, DeckDoctorReport, DeckIntent } from "@/lib/types";
import { getIntent } from "@/lib/deck/intent";
import { buildDoctorReport } from "@/lib/doctor";

/** Everything an advisor needs, in a compact serialisable shape. */
export interface DeckContext {
  deckName: string;
  commanders: { name: string; oracleText: string; colorIdentity: string[] }[];
  colorIdentity: string[];
  intent: DeckIntent;
  cards: { name: string; manaValue: number; typeLine: string; roles: string[]; tags: string[]; protection?: "locked" | "favorite" | "flavor" }[];
  stats: { cards: number; lands: number; averageManaValue: number; totalPrice: number };
  roleCounts: Record<string, number>;
  themes: { id: string; name: string; score: number }[];
  packages: { name: string; strength: number; enablers: string[]; payoffs: string[] }[];
  combos: { name: string; type: string; cards: string[] }[];
  winConditions: { type: string; strength: number }[];
  manaConcerns: string[];
  disconnected: string[];
}

export interface AdvisorRecommendation {
  kind: "add" | "cut" | "swap" | "observation";
  title: string;
  /** Always deck-specific: refers to counts, packages or partner cards. */
  reason: string;
  cards?: string[];
  confidence: number;
}

export interface AdvisorResult {
  /** Which implementation produced this ("local" or a server provider id). */
  provider: string;
  summary: string;
  recommendations: AdvisorRecommendation[];
}

export interface DeckAdvisor {
  id: string;
  advise(context: DeckContext, report: DeckDoctorReport): Promise<AdvisorResult>;
}

export function buildDeckContext(deck: Deck, analysis: DeckAnalysis, report: DeckDoctorReport): DeckContext {
  const roleCounts: Record<string, number> = {};
  for (const [role, cards] of Object.entries(analysis.categories)) roleCounts[role] = cards.length;
  return {
    deckName: deck.name,
    commanders: deck.commanders.map((c) => ({ name: c.card.name, oracleText: c.card.oracleText, colorIdentity: c.card.colorIdentity })),
    colorIdentity: [...new Set(deck.commanders.flatMap((c) => c.card.colorIdentity))],
    intent: getIntent(deck),
    cards: deck.cards
      .filter((d) => (d.board ?? "main") === "main")
      .map((d) => ({
        name: d.card.name,
        manaValue: d.card.cmc,
        typeLine: d.card.typeLine,
        roles: analysis.cardCategories[d.card.name]?.categories ?? [],
        tags: analysis.cardCategories[d.card.name]?.tags.map((t) => t.value) ?? [],
        protection: d.locked ? "locked" : d.favorite ? "favorite" : d.flavorEssential ? "flavor" : undefined,
      })),
    stats: { cards: analysis.totalCards, lands: analysis.landCount, averageManaValue: analysis.averageManaValue, totalPrice: analysis.totalPrice },
    roleCounts,
    themes: analysis.themes.map((t) => ({ id: t.id, name: t.name, score: t.score })),
    packages: analysis.packages.map((p) => ({ name: p.name, strength: p.strength, enablers: p.enablers, payoffs: p.payoffs })),
    combos: analysis.combos.filter((c) => c.type !== "near").map((c) => ({ name: c.definition.name, type: c.type, cards: c.present })),
    winConditions: analysis.winConditions.conditions.map((c) => ({ type: c.type, strength: c.strength })),
    manaConcerns: report.manaConcerns.map((m) => m.title),
    disconnected: report.disconnected.map((d) => d.name),
  };
}

/** Deterministic advisor built from the Deck Doctor report. */
export class LocalDeckAdvisor implements DeckAdvisor {
  id = "local";
  async advise(context: DeckContext, report: DeckDoctorReport): Promise<AdvisorResult> {
    const recs: AdvisorRecommendation[] = [];
    for (const w of report.weaknesses.slice(0, 4)) recs.push({ kind: "observation", title: w.title, reason: w.detail, cards: w.cards, confidence: 0.6 });
    for (const d of report.disconnected.slice(0, 3)) recs.push({ kind: "cut", title: `Consider testing without ${d.name}`, reason: d.note, cards: [d.name], confidence: 0.45 });
    for (const c of report.combos.filter((c) => c.type === "near").slice(0, 2)) {
      recs.push({ kind: "add", title: `Complete ${c.definition.name}`, reason: `${c.present.join(" and ")} ${c.present.length === 1 ? "is" : "are"} already in the deck; adding ${c.missing.join(", ")} would finish it: ${c.definition.result}`, cards: c.missing, confidence: 0.55 });
    }
    const primary = report.primary;
    return {
      provider: this.id,
      summary: primary
        ? `${context.deckName} reads as a ${primary.name} deck${report.secondary.length ? ` with ${report.secondary.slice(0, 2).map((s) => s.name).join(" and ")} elements` : ""}. ${report.gamePlan}`
        : `${context.deckName} does not show a dominant strategy yet. ${report.gamePlan}`,
      recommendations: recs,
    };
  }
}

let advisor: DeckAdvisor = new LocalDeckAdvisor();

export function getDeckAdvisor(): DeckAdvisor {
  return advisor;
}

/** Swap in another implementation (e.g. a server-backed advisor). */
export function setDeckAdvisor(next: DeckAdvisor) {
  advisor = next;
}

/** Convenience: build context + report and ask the current advisor. */
export async function adviseDeck(deck: Deck, analysis: DeckAnalysis): Promise<{ report: DeckDoctorReport; context: DeckContext; result: AdvisorResult }> {
  const report = buildDoctorReport(deck, analysis);
  const context = buildDeckContext(deck, analysis, report);
  const result = await getDeckAdvisor().advise(context, report);
  return { report, context, result };
}
