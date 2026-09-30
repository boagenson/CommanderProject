import { describe, expect, it } from "vitest";
import { drawCard, handStats, landProbability, mulligan, newGame, simulateHands } from "@/lib/simulation/engine";
import { playtestInsights } from "@/lib/playtest/analyzer";
import type { PlaytestEntry } from "@/lib/types";
import { deckFromText, fixtureCard } from "./helpers";

describe("opening hand simulator", () => {
  const deck = deckFromText();

  it("is deterministic for a seed and draws from a 99-card library", () => {
    const a = newGame(deck, 42);
    const b = newGame(deck, 42);
    expect(a.hand.map((c) => c.name)).toEqual(b.hand.map((c) => c.name));
    expect(a.hand).toHaveLength(7);
    const librarySize = deck.cards.reduce((n, d) => n + d.quantity, 0);
    expect(a.hand.length + a.library.length).toBe(librarySize);
    expect(newGame(deck, 43).hand.map((c) => c.name)).not.toEqual(a.hand.map((c) => c.name));
  });

  it("mulligans London-style and draws from the top of the library", () => {
    const g = newGame(deck, 7);
    const m = mulligan(g, deck);
    expect(m.mulligans).toBe(1);
    expect(m.hand).toHaveLength(6);
    expect(m.hand.length + m.library.length).toBe(deck.cards.reduce((n, d) => n + d.quantity, 0));
    const next = drawCard(m);
    expect(next.hand).toHaveLength(7);
    expect(next.drawn[0].name).toBe(m.library[0].name);
  });

  it("describes a hand's lands, ramp and castability", () => {
    const hand = [fixtureCard("Plains"), fixtureCard("Swamp"), fixtureCard("Sol Ring"), fixtureCard("Swords to Plowshares"), fixtureCard("Harmonize"), fixtureCard("Night's Whisper"), fixtureCard("Sun Titan")];
    const s = handStats(hand, ["W", "B", "G"]);
    expect(s.lands).toBe(2);
    expect(s.ramp).toBe(1);
    expect(s.interaction).toBe(1);
    expect(s.cardDraw).toBe(2);
    expect(s.colors).toEqual(["W", "B"]);
    expect(s.uncastableByColor).toBe(1); // Harmonize needs green
  });

  it("samples 100 hands with a land distribution that sums to the sample size", () => {
    const r = simulateHands(deck, ["W", "B", "G"], 100, 1);
    expect(r.hands).toBe(100);
    expect(r.landDistribution).toHaveLength(6);
    expect(r.landDistribution.reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.keepable).toBeGreaterThan(60);
    expect(r.averageLands).toBeGreaterThan(1.5);
    expect(r.averageLands).toBeLessThan(4);
    expect(simulateHands(deck, ["W", "B", "G"], 100, 1)).toEqual(r);
  });

  it("computes hypergeometric land probabilities", () => {
    const p = landProbability(99, 36, 3);
    expect(p).toBeGreaterThan(0.25);
    expect(p).toBeLessThan(0.35);
    const total = [0, 1, 2, 3, 4, 5, 6, 7].reduce((n, k) => n + landProbability(99, 36, k), 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("playtest insights", () => {
  const entry = (i: number, partial: Partial<PlaytestEntry>): PlaytestEntry => ({
    id: `g${i}`,
    date: Date.UTC(2026, 0, i + 1),
    performedWell: [],
    underperformed: [],
    stuckInHand: [],
    tags: [],
    ...partial,
  });

  it("needs a minimum sample before reporting tag trends, and shows sample sizes", () => {
    const two = [entry(1, { tags: ["Mana Screwed"] }), entry(2, { tags: ["Mana Screwed"] })];
    expect(playtestInsights(two).some((i) => i.id === "tag-Mana Screwed")).toBe(false);
    const five = [...two, entry(3, { tags: ["Mana Screwed"] }), entry(4, { result: "Win" }), entry(5, { result: "Loss" })];
    const insights = playtestInsights(five);
    const screw = insights.find((i) => i.id === "tag-Mana Screwed")!;
    expect(screw.support).toBe(3);
    expect(screw.total).toBe(5);
    expect(screw.detail).toMatch(/3 of/);
  });

  it("surfaces cards that repeatedly underperform or get stuck", () => {
    const games = [entry(1, { underperformed: ["Sun Titan"], stuckInHand: ["Harmonize"] }), entry(2, { underperformed: ["Sun Titan"], stuckInHand: ["Harmonize"] })];
    const insights = playtestInsights(games);
    expect(insights.some((i) => i.cards?.includes("Sun Titan"))).toBe(true);
    expect(insights.some((i) => i.cards?.includes("Harmonize"))).toBe(true);
  });

  it("returns nothing for an empty log", () => {
    expect(playtestInsights([])).toEqual([]);
  });
});
