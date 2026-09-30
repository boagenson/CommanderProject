/**
 * Deck comparison: before/after deltas between two analyses, used by
 * Test Cut, Sandbox and Version History. Pure data; the UI formats it.
 */
import type { DeckAnalysis, FunctionalCategory } from "@/lib/types";

export interface MetricDelta {
  id: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  /** How to print the numbers. */
  format: "int" | "decimal" | "price" | "pct";
  /** Whether a higher number is generally better (undefined = neutral). */
  higherIsBetter?: boolean;
  group: "overview" | "roles" | "themes" | "mana" | "wincons";
}

export interface CardDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface DeckComparison {
  metrics: MetricDelta[];
  /** Only metrics whose value changed. */
  changed: MetricDelta[];
}

const ROLE_METRICS: FunctionalCategory[] = ["Ramp", "Card Draw", "Card Advantage", "Targeted Removal", "Board Wipes", "Protection", "Graveyard Recursion", "Tutors", "Token Generation", "Sacrifice Outlets", "Lifegain", "Drain", "Finishers"];

export function compareAnalyses(before: DeckAnalysis, after: DeckAnalysis): DeckComparison {
  const metrics: MetricDelta[] = [];
  const push = (m: Omit<MetricDelta, "delta">) => metrics.push({ ...m, delta: round(m.after - m.before, m.format) });

  push({ id: "cards", label: "Cards", before: before.totalCards, after: after.totalCards, format: "int", group: "overview" });
  push({ id: "lands", label: "Lands", before: before.landCount, after: after.landCount, format: "int", group: "overview" });
  push({ id: "avg-mv", label: "Average mana value", before: before.averageManaValue, after: after.averageManaValue, format: "decimal", higherIsBetter: false, group: "overview" });
  push({ id: "price", label: "Estimated value", before: before.totalPrice, after: after.totalPrice, format: "price", group: "overview" });

  for (const role of ROLE_METRICS) {
    push({ id: `role-${role}`, label: role, before: before.categories[role].length, after: after.categories[role].length, format: "int", higherIsBetter: role !== "Finishers" ? true : undefined, group: "roles" });
  }

  const themeIds = new Set([...before.themes.map((t) => t.id), ...after.themes.map((t) => t.id)]);
  for (const id of themeIds) {
    const b = before.themes.find((t) => t.id === id);
    const a = after.themes.find((t) => t.id === id);
    push({ id: `theme-${id}`, label: `${(a ?? b)!.name} synergy`, before: b?.score ?? 0, after: a?.score ?? 0, format: "int", higherIsBetter: true, group: "themes" });
  }

  for (const d of after.mana.demand) {
    const b = before.mana.demand.find((x) => x.color === d.color);
    push({ id: `mana-src-${d.color}`, label: `${d.color} sources`, before: b?.sources ?? 0, after: d.sources, format: "decimal", higherIsBetter: true, group: "mana" });
    push({ id: `mana-pips-${d.color}`, label: `${d.color} pips`, before: b?.pips ?? 0, after: d.pips, format: "decimal", group: "mana" });
  }
  push({ id: "ramp-sources", label: "Nonland mana producers", before: before.mana.rampCount, after: after.mana.rampCount, format: "int", higherIsBetter: true, group: "mana" });

  const winIds = new Set([...before.winConditions.conditions.map((c) => c.type), ...after.winConditions.conditions.map((c) => c.type)]);
  for (const type of winIds) {
    const b = before.winConditions.conditions.find((c) => c.type === type);
    const a = after.winConditions.conditions.find((c) => c.type === type);
    push({ id: `win-${type}`, label: type, before: b?.strength ?? 0, after: a?.strength ?? 0, format: "int", higherIsBetter: true, group: "wincons" });
  }

  return { metrics, changed: metrics.filter((m) => m.delta !== 0) };
}

/** Card-level diff between two name→quantity maps. */
export function diffCardLists(before: Map<string, number>, after: Map<string, number>): CardDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];
  for (const [name, qty] of after) {
    const prev = before.get(name) ?? 0;
    if (prev === 0) added.push(qty > 1 ? `${qty} ${name}` : name);
    else if (qty > prev) added.push(`${qty - prev} ${name}`);
    if (prev > 0) unchanged.push(name);
  }
  for (const [name, qty] of before) {
    const next = after.get(name) ?? 0;
    if (next === 0) removed.push(qty > 1 ? `${qty} ${name}` : name);
    else if (next < qty) removed.push(`${qty - next} ${name}`);
  }
  return { added: added.sort(), removed: removed.sort(), unchanged: unchanged.filter((n) => (after.get(n) ?? 0) === (before.get(n) ?? 0)).sort() };
}

export function formatMetric(value: number, format: MetricDelta["format"]) {
  switch (format) {
    case "decimal":
      return value.toFixed(2);
    case "price":
      return `$${value.toFixed(2)}`;
    case "pct":
      return `${Math.round(value)}%`;
    default:
      return String(Math.round(value));
  }
}

function round(n: number, format: MetricDelta["format"]) {
  return format === "int" ? Math.round(n) : Math.round(n * 100) / 100;
}
