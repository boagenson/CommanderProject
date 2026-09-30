import { describe, expect, it } from "vitest";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { findCombos, registerComboSource, allComboDefinitions } from "@/lib/combo/engine";
import { setWinConditionOverride } from "@/lib/deck/operations";
import { deckFromText } from "./helpers";

describe("combo engine", () => {
  it("detects infinite combos, engines and near-combos by card name", () => {
    const found = findCombos(["Sanguine Bond", "Exquisite Blood", "Academy Manufactor", "Peregrin Took", "Heliod, Sun-Crowned"], { includeNear: true });
    const byId = new Map(found.map((c) => [c.definition.id, c]));
    expect([...byId.values()].some((c) => c.type === "infinite" && c.present.includes("Sanguine Bond") && c.present.includes("Exquisite Blood"))).toBe(true);
    expect([...byId.values()].some((c) => c.type === "engine" && c.present.includes("Academy Manufactor"))).toBe(true);
    const near = found.filter((c) => c.type === "near");
    expect(near.some((c) => c.present.includes("Heliod, Sun-Crowned") && c.missing.includes("Walking Ballista"))).toBe(true);
    // Without near-combos, Heliod alone is not reported.
    expect(findCombos(["Heliod, Sun-Crowned"]).length).toBe(0);
  });

  it("accepts additional combo sources without touching the built-in list", () => {
    const before = allComboDefinitions().length;
    registerComboSource({
      id: "test-source",
      definitions: () => [{ id: "test-combo", name: "Test combo", type: "synergy", required: ["Soul Warden", "Viscera Seer"], optional: [], result: "Value", description: "Test." }],
    });
    expect(allComboDefinitions().length).toBe(before + 1);
    expect(findCombos(["Soul Warden", "Viscera Seer"]).some((c) => c.definition.id === "test-combo")).toBe(true);
  });
});

describe("win condition analysis", () => {
  const deck = deckFromText();

  it("finds the sample deck's drain and combo win conditions with explanations", () => {
    const report = analyzeDeck(deck).winConditions;
    const types = report.conditions.map((c) => c.type);
    expect(types).toContain("Infinite combo");
    expect(types).toContain("Life drain");
    for (const c of report.conditions) {
      expect(c.explanation.length).toBeGreaterThan(10);
      expect(c.cards.length).toBeGreaterThan(0);
    }
    expect(report.unclear).toBe(false);
  });

  it("marks a deck with no clear finisher as unclear", () => {
    const lands = { ...deck, cards: deck.cards.filter((d) => d.card.typeLine.includes("Land")), commanders: [] };
    const report = analyzeDeck(lands).winConditions;
    expect(report.unclear).toBe(true);
    expect(report.note).toMatch(/could not identify a clear finishing plan/i);
  });

  it("honours manual corrections in both directions", () => {
    const withAlt = setWinConditionOverride(deck, "Alternate win condition", "on");
    const on = analyzeDeck(withAlt).winConditions;
    const alt = on.conditions.find((c) => c.type === "Alternate win condition");
    expect(alt?.manual).toBe(true);
    expect(alt!.strength).toBeGreaterThanOrEqual(60);
    const without = setWinConditionOverride(deck, "Life drain", "off");
    expect(analyzeDeck(without).winConditions.conditions.map((c) => c.type)).not.toContain("Life drain");
  });
});
