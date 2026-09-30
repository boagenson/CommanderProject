import { describe, expect, it } from "vitest";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { compareAnalyses, diffCardLists } from "@/lib/analysis/compare";
import { applySandbox, cardCounts, EMPTY_SANDBOX, pushChange, redo, undo } from "@/lib/deck/sandbox";
import { addVersion, compareVersions, createVersion, hasUnversionedChanges } from "@/lib/deck/versions";
import { removeCard } from "@/lib/deck/operations";
import { deckFromText, fixtureCard } from "./helpers";

describe("deck comparison", () => {
  const deck = deckFromText();
  const before = analyzeDeck(deck);

  it("reports metric deltas and only flags changed metrics", () => {
    const after = analyzeDeck(removeCard(deck, fixtureCard("Sol Ring").oracleId));
    const cmp = compareAnalyses(before, after);
    const ramp = cmp.metrics.find((m) => m.id === "role-Ramp")!;
    expect(ramp.before - ramp.after).toBe(1);
    expect(cmp.changed.some((m) => m.id === "role-Ramp")).toBe(true);
    expect(cmp.changed.some((m) => m.id === "lands")).toBe(false);
    expect(compareAnalyses(before, before).changed).toHaveLength(0);
  });

  it("diffs card lists into added, removed and unchanged with quantities", () => {
    const a = new Map([["Plains", 5], ["Sol Ring", 1], ["Sun Titan", 1]]);
    const b = new Map([["Plains", 4], ["Sol Ring", 1], ["Mirkwood Bats", 1]]);
    const diff = diffCardLists(a, b);
    expect(diff.added).toEqual(["Mirkwood Bats"]);
    expect(diff.removed).toEqual(expect.arrayContaining(["Sun Titan", "1 Plains"]));
    expect(diff.unchanged).toEqual(["Sol Ring"]);
  });
});

describe("sandbox", () => {
  const deck = deckFromText();

  it("applies changes without touching the saved deck, and undo/redo restore them", () => {
    let state = pushChange(EMPTY_SANDBOX, { kind: "add", card: fixtureCard("Mirkwood Bats"), quantity: 1 });
    state = pushChange(state, { kind: "remove", oracleId: fixtureCard("Sun Titan").oracleId, name: "Sun Titan", quantity: 1 });
    state = pushChange(state, { kind: "swap", remove: fixtureCard("Harmonize"), add: fixtureCard("Village Rites") });
    const sandboxDeck = applySandbox(deck, state);
    const names = cardCounts(sandboxDeck);
    expect(names.get("Mirkwood Bats")).toBe(1);
    expect(names.has("Sun Titan")).toBe(false);
    expect(names.has("Harmonize")).toBe(false);
    expect(names.get("Village Rites")).toBe(1);
    expect(sandboxDeck.updatedAt).toBe(deck.updatedAt);
    // The original is untouched.
    expect(cardCounts(deck).get("Sun Titan")).toBe(1);
    expect(cardCounts(deck).has("Mirkwood Bats")).toBe(false);

    const undone = undo(state);
    expect(cardCounts(applySandbox(deck, undone)).has("Harmonize")).toBe(true);
    expect(undone.redo).toHaveLength(1);
    const redone = redo(undone);
    expect(cardCounts(applySandbox(deck, redone)).has("Harmonize")).toBe(false);
    expect(applySandbox(deck, EMPTY_SANDBOX)).toBe(deck);
  });

  it("removes only one copy of a multi-quantity card", () => {
    const state = pushChange(EMPTY_SANDBOX, { kind: "remove", oracleId: fixtureCard("Plains").oracleId, name: "Plains", quantity: 1 });
    const before = cardCounts(deck).get("Plains")!;
    expect(cardCounts(applySandbox(deck, state)).get("Plains")).toBe(before - 1);
  });
});

describe("version history", () => {
  const deck = deckFromText();
  const analysis = analyzeDeck(deck);

  it("snapshots the list with stats and records what changed since the previous version", () => {
    const v1 = createVersion(deck, analysis, "Initial build");
    expect(v1.number).toBe(1);
    expect(v1.added).toEqual([]);
    expect(v1.stats.lands).toBe(analysis.landCount);
    let d = addVersion(deck, v1);
    expect(hasUnversionedChanges(d)).toBe(false);
    d = removeCard(d, fixtureCard("Sun Titan").oracleId);
    expect(hasUnversionedChanges(d)).toBe(true);
    const v2 = createVersion(d, analyzeDeck(d), "Cut Sun Titan");
    expect(v2.number).toBe(2);
    expect(v2.removed).toEqual(["Sun Titan"]);
    expect(v2.added).toEqual([]);
    const cmp = compareVersions(v1, v2);
    expect(cmp.removed).toEqual(["Sun Titan"]);
    expect(cmp.unchanged.length).toBeGreaterThan(70);
    expect(cmp.stats.find((s) => s.label === "Cards")!.delta).toBe(-1);
  });
});
