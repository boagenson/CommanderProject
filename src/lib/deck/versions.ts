/**
 * Deck versions: compact snapshots stored on the deck. A version records the
 * card list, what changed since the previous version and summary statistics,
 * so the change log renders without re-running analysis. Card data for a
 * version is resolved from the current deck when needed (versions store names
 * and oracle ids, not full cards, to keep localStorage small).
 */
import type { Deck, DeckAnalysis, DeckSnapshotStats, DeckVersion } from "@/lib/types";
import { diffCardLists, type CardDiff } from "@/lib/analysis/compare";
import { cardCounts } from "./sandbox";
import { newId } from "./operations";

export function snapshotStats(analysis: DeckAnalysis): DeckSnapshotStats {
  return {
    cards: analysis.totalCards,
    lands: analysis.landCount,
    averageManaValue: Math.round(analysis.averageManaValue * 100) / 100,
    ramp: analysis.categories.Ramp.length,
    cardDraw: analysis.categories["Card Draw"].length,
    removal: analysis.categories["Targeted Removal"].length,
    totalPrice: Math.round(analysis.totalPrice * 100) / 100,
    themes: analysis.themes.slice(0, 5).map((t) => ({ id: t.id, name: t.name, score: t.score })),
  };
}

export function versionCounts(v: DeckVersion): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of v.commanders) out.set(c, (out.get(c) ?? 0) + 1);
  for (const c of v.cards) out.set(c.name, (out.get(c.name) ?? 0) + c.quantity);
  return out;
}

/** Create a version snapshot of `deck` (which should already include the changes). */
export function createVersion(deck: Deck, analysis: DeckAnalysis, notes = "", name?: string): DeckVersion {
  const versions = deck.versions ?? [];
  const prev = versions[versions.length - 1];
  const number = (prev?.number ?? 0) + 1;
  const now = cardCounts(deck);
  const diff = prev ? diffCardLists(versionCounts(prev), now) : { added: [], removed: [], unchanged: [] };
  return {
    id: newId(),
    number,
    name: name?.trim() || `${deck.name} — v${number}`,
    createdAt: Date.now(),
    notes,
    cards: deck.cards.filter((d) => (d.board ?? "main") === "main").map((d) => ({ name: d.card.name, oracleId: d.card.oracleId, quantity: d.quantity })),
    commanders: deck.commanders.map((c) => c.card.name),
    added: diff.added,
    removed: diff.removed,
    stats: snapshotStats(analysis),
  };
}

export function addVersion(deck: Deck, version: DeckVersion): Deck {
  return { ...deck, versions: [...(deck.versions ?? []), version], updatedAt: Date.now() };
}

export function removeVersion(deck: Deck, versionId: string): Deck {
  return { ...deck, versions: (deck.versions ?? []).filter((v) => v.id !== versionId), updatedAt: Date.now() };
}

export interface VersionComparison extends CardDiff {
  a: DeckVersion;
  b: DeckVersion;
  stats: { label: string; a: number; b: number; delta: number; format: "int" | "decimal" | "price" }[];
}

/** Compare two versions: card diff plus statistical differences. */
export function compareVersions(a: DeckVersion, b: DeckVersion): VersionComparison {
  const diff = diffCardLists(versionCounts(a), versionCounts(b));
  const row = (label: string, x: number, y: number, format: "int" | "decimal" | "price" = "int") => ({ label, a: x, b: y, delta: Math.round((y - x) * 100) / 100, format });
  return {
    a,
    b,
    ...diff,
    stats: [
      row("Cards", a.stats.cards, b.stats.cards),
      row("Lands", a.stats.lands, b.stats.lands),
      row("Average mana value", a.stats.averageManaValue, b.stats.averageManaValue, "decimal"),
      row("Ramp", a.stats.ramp, b.stats.ramp),
      row("Card draw", a.stats.cardDraw, b.stats.cardDraw),
      row("Targeted removal", a.stats.removal, b.stats.removal),
      row("Estimated value", a.stats.totalPrice, b.stats.totalPrice, "price"),
      ...[...new Set([...a.stats.themes.map((t) => t.id), ...b.stats.themes.map((t) => t.id)])].map((id) => {
        const ta = a.stats.themes.find((t) => t.id === id);
        const tb = b.stats.themes.find((t) => t.id === id);
        return row(`${(ta ?? tb)!.name} synergy`, ta?.score ?? 0, tb?.score ?? 0);
      }),
    ],
  };
}

/** Does the current deck differ from the latest version? */
export function hasUnversionedChanges(deck: Deck): boolean {
  const last = deck.versions?.[deck.versions.length - 1];
  if (!last) return deck.cards.length > 0;
  const diff = diffCardLists(versionCounts(last), cardCounts(deck));
  return diff.added.length > 0 || diff.removed.length > 0;
}
