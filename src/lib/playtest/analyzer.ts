/**
 * Playtest insights: patterns across recorded games. Every insight carries
 * the number of games that support it and the total considered, and the
 * thresholds below keep the app from over-reading a tiny sample.
 */
import type { PlaytestEntry, PlaytestInsight, PlaytestTag } from "@/lib/types";

export const INSIGHT_THRESHOLDS = {
  /** Fewer games than this: only card-level repeat notes are shown. */
  minGames: 3,
  /** Recent window for "of your last N games". */
  window: 10,
  /** Share of games with a tag before it becomes an insight. */
  tagShare: 0.4,
  /** A card must be mentioned in at least this many games. */
  cardRepeats: 2,
};

const TAG_INSIGHTS: Partial<Record<PlaytestTag, { title: string; detail: (n: number, total: number) => string; severity: PlaytestInsight["severity"] }>> = {
  "Mana Screwed": { title: "Mana issues keep coming up", detail: (n, t) => `You've marked mana problems in ${n} of your last ${t} games. Consider testing one more land or cheap ramp piece, and check the Mana Base Doctor for color gaps.`, severity: "warning" },
  "Mana Flooded": { title: "Flooding out", detail: (n, t) => `${n} of your last ${t} games were marked as mana flooded. A land could become a spell, or the deck may want more mana sinks and card draw.`, severity: "info" },
  "Needed More Draw": { title: "Running out of cards", detail: (n, t) => `${n} of your last ${t} playtests mention needing more draw. The Deck Doctor's card-advantage count is worth a look.`, severity: "warning" },
  "Needed More Removal": { title: "Wanting more interaction", detail: (n, t) => `${n} of your last ${t} games called for more removal.`, severity: "warning" },
  "Couldn't Finish Game": { title: "Games stalling", detail: (n, t) => `${n} of your last ${t} games ended without a finish. Compare with the Win Conditions section: the deck may build a board without converting it.`, severity: "warning" },
  "Strong Synergy": { title: "The engine is working", detail: (n, t) => `${n} of your last ${t} games were marked as strong synergy.`, severity: "info" },
  "Great Opening Hand": { title: "Opening hands are landing", detail: (n, t) => `${n} of your last ${t} games started with a great hand.`, severity: "info" },
  "Commander Removed Repeatedly": { title: "Commander under fire", detail: (n, t) => `In ${n} of your last ${t} games the commander was removed repeatedly. Protection or recursion may be worth testing.`, severity: "warning" },
};

export function playtestInsights(entries: PlaytestEntry[]): PlaytestInsight[] {
  const recent = [...entries].sort((a, b) => b.date - a.date).slice(0, INSIGHT_THRESHOLDS.window);
  const total = recent.length;
  const out: PlaytestInsight[] = [];

  if (total >= INSIGHT_THRESHOLDS.minGames) {
    for (const [tag, def] of Object.entries(TAG_INSIGHTS) as [PlaytestTag, NonNullable<(typeof TAG_INSIGHTS)[PlaytestTag]>][]) {
      const n = recent.filter((e) => e.tags.includes(tag)).length;
      if (n >= 2 && n / total >= INSIGHT_THRESHOLDS.tagShare) {
        out.push({ id: `tag-${tag}`, title: def.title, detail: def.detail(n, total), support: n, total, severity: def.severity });
      }
    }
    const manaNotes = recent.filter((e) => e.manaIssues?.trim() || e.tags.includes("Mana Screwed") || e.tags.includes("Mana Flooded")).length;
    if (manaNotes >= 2 && manaNotes / total >= INSIGHT_THRESHOLDS.tagShare && !out.some((i) => i.id === "tag-Mana Screwed")) {
      out.push({ id: "mana-notes", title: "Mana notes in several games", detail: `You've written mana notes in ${manaNotes} of your last ${total} games.`, support: manaNotes, total, severity: "info" });
    }
    const results = recent.filter((e) => e.result && e.result !== "Unfinished");
    const wins = results.filter((e) => e.result === "Win").length;
    if (results.length >= 4) {
      out.push({ id: "record", title: `Record: ${wins}–${results.length - wins}`, detail: `${wins} win${wins === 1 ? "" : "s"} in ${results.length} finished games. Small samples swing a lot; treat this as a trend, not a rate.`, support: wins, total: results.length, severity: "info" });
    }
    const lengths = recent.map((e) => e.turns).filter((n): n is number => typeof n === "number" && n > 0);
    if (lengths.length >= 3) {
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      out.push({ id: "length", title: `Games last about ${Math.round(avg)} turns`, detail: `Across ${lengths.length} games with a recorded length.`, support: lengths.length, total, severity: "info" });
    }
  }

  // Card-level repeats work even with two games.
  const count = (pick: (e: PlaytestEntry) => string[]) => {
    const map = new Map<string, number>();
    for (const e of recent) for (const name of new Set(pick(e).map((n) => n.trim()).filter(Boolean))) map.set(name, (map.get(name) ?? 0) + 1);
    return [...map].filter(([, n]) => n >= INSIGHT_THRESHOLDS.cardRepeats).sort((a, b) => b[1] - a[1]);
  };
  for (const [name, n] of count((e) => e.underperformed).slice(0, 5)) {
    out.push({ id: `under-${name}`, title: `${name} has underperformed ${n} times`, detail: `Marked as underperforming in ${n} of ${total} recent games. Consider a Test Cut to see what the deck loses without it.`, support: n, total, cards: [name], severity: "warning" });
  }
  for (const [name, n] of count((e) => e.stuckInHand).slice(0, 5)) {
    out.push({ id: `stuck-${name}`, title: `${name} keeps getting stuck in hand`, detail: `Stuck in hand in ${n} of ${total} recent games. Check its color requirements against the Mana Base Doctor.`, support: n, total, cards: [name], severity: "info" });
  }
  for (const [name, n] of count((e) => e.performedWell).slice(0, 5)) {
    out.push({ id: `well-${name}`, title: `${name} has performed well ${n} times`, detail: `A candidate for Favorite, so upgrades avoid cutting it.`, support: n, total, cards: [name], severity: "info" });
  }

  if (!out.length && total > 0 && total < INSIGHT_THRESHOLDS.minGames) {
    out.push({ id: "need-more", title: "Not enough games yet", detail: `${total} game${total === 1 ? "" : "s"} recorded. Patterns appear after ${INSIGHT_THRESHOLDS.minGames} or more.`, support: total, total, severity: "info" });
  }
  return out;
}
