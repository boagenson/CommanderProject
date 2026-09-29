import { describe, expect, it } from "vitest";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { toggleLock } from "@/lib/deck/operations";
import { buildContext, planSwaps, recommend, rankCuts } from "@/lib/upgrade";
import type { CandidatePool } from "@/lib/upgrade/candidates";
import type { UpgradeOptions } from "@/lib/types";
import { CANDIDATE_NAMES } from "../fixtures/cards";
import { deckFromText, fixtureCard } from "./helpers";

const pool = (): CandidatePool => {
  const cards = CANDIDATE_NAMES.map(fixtureCard);
  return {
    cards,
    rank: new Map(cards.map((c, i) => [c.oracleId, i / cards.length])),
    sources: new Map(),
    errors: [],
  };
};

const options: UpgradeOptions = { budget: 25, strategy: "Focused", goals: ["More Synergy"], maxSwaps: 6 };

describe("upgrade engine", () => {
  const deck = deckFromText();
  const analysis = analyzeDeck(deck);

  it("recommends on-plan cards within identity, legality and budget", () => {
    const ctx = buildContext(deck, analysis, options);
    const recs = recommend(deck, ctx, pool());
    const names = recs.map((r) => r.card.name);
    expect(names).not.toContain("Grim Lavamancer"); // off-color
    expect(names).not.toContain("Mana Crypt"); // banned
    expect(names).not.toContain("The Great Henge"); // over budget
    expect(names.slice(0, 5)).toEqual(expect.arrayContaining(["Bastion of Remembrance", "Cruel Celebrant"]));
    for (const r of recs) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("never proposes cutting locked cards or commanders", () => {
    let locked = deck;
    const ctx0 = buildContext(deck, analysis, options);
    const weakest = rankCuts(deck.cards, ctx0)[0].deckCard.card;
    locked = toggleLock(locked, weakest.oracleId);
    const ctx = buildContext(locked, analysis, options);
    const swaps = planSwaps(locked, ctx, recommend(locked, ctx, pool()));
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.remove.oracleId).not.toBe(weakest.oracleId);
      expect(["Frodo, Adventurous Hobbit", "Sam, Loyal Attendant"]).not.toContain(s.remove.name);
    }
  });

  it("stays within budget and swap limit", () => {
    const ctx = buildContext(deck, analysis, { ...options, budget: 3, maxSwaps: 2 });
    const swaps = planSwaps(deck, ctx, recommend(deck, ctx, pool()));
    expect(swaps.length).toBeLessThanOrEqual(2);
    const spent = swaps.reduce((n, s) => n + (s.add.prices.usd ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(3);
  });

  it("swaps basics for duals when improving the mana base", () => {
    const ctx = buildContext(deck, analysis, { ...options, goals: ["Better Mana Base"] });
    const swaps = planSwaps(deck, ctx, recommend(deck, ctx, pool()));
    const land = swaps.find((s) => s.add.name === "Caves of Koilos" || s.add.name === "Llanowar Wastes");
    expect(land).toBeDefined();
    expect(["Plains", "Swamp", "Forest"]).toContain(land!.remove.name);
    // Sanity: the cut card exists in the deck.
    expect(fixtureCard(land!.remove.name)).toBeDefined();
  });

  it("never swaps a card for a costlier card with the same role", () => {
    const ctx = buildContext(deck, analysis, options);
    for (const s of planSwaps(deck, ctx, recommend(deck, ctx, pool()))) {
      const shared = s.addedCategories.some((c) => s.removedCategories.includes(c));
      if (shared) expect(s.add.cmc).toBeLessThanOrEqual(s.remove.cmc);
    }
  });

  it("does not raise mana value when lowering the curve", () => {
    const ctx = buildContext(deck, analysis, { ...options, goals: ["Lower Mana Curve"] });
    const swaps = planSwaps(deck, ctx, recommend(deck, ctx, pool()));
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) expect(s.manaValueDelta).toBeLessThanOrEqual(0);
  });

  it("values cheap cards above pricier cards in the same role when choosing cuts", () => {
    const ctx = buildContext(deck, analysis, options);
    const value = new Map(rankCuts(deck.cards, ctx).map((c) => [c.deckCard.card.name, c.value]));
    expect(value.get("Birds of Paradise")!).toBeGreaterThan(value.get("Cultivate")!);
  });
});

