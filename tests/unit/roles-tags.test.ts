import { describe, expect, it } from "vitest";
import { classifyCard, effectiveRoles } from "@/lib/analysis/categories";
import { classifyTags, effectiveTags } from "@/lib/analysis/tags";
import { setTagOverride, setCategoryOverride } from "@/lib/deck/operations";
import { deckFromText, fixtureCard } from "./helpers";

describe("multi-role classification with confidence", () => {
  it("assigns several roles to one card, each with a reason and confidence", () => {
    const matches = classifyCard(fixtureCard("Academy Manufactor"));
    const roles = matches.map((m) => m.category);
    expect(roles).toContain("Payoff");
    expect(roles).toContain("Card Advantage");
    expect(roles.length).toBeGreaterThanOrEqual(2);
    for (const m of matches) {
      expect(m.reason.length).toBeGreaterThan(5);
      expect(m.confidence).toBeGreaterThan(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("detects thematic tags from rules text with a reason", () => {
    const tags = classifyTags(fixtureCard("Sam, Loyal Attendant")).map((t) => t.value);
    expect(tags).toContain("Food");
    expect(tags).toContain("Token");
    const frodo = classifyTags(fixtureCard("Frodo, Adventurous Hobbit")).map((t) => t.value);
    expect(frodo).toContain("Lifegain");
    expect(classifyTags(fixtureCard("Plains"))).toEqual([]);
  });

  it("manual role and tag overrides win over detection", () => {
    let deck = deckFromText();
    const seer = deck.cards.find((d) => d.card.name === "Viscera Seer")!;
    deck = setCategoryOverride(deck, seer.card.oracleId, "Card Draw", "on");
    deck = setCategoryOverride(deck, seer.card.oracleId, "Sacrifice Outlets", "off");
    deck = setTagOverride(deck, seer.card.oracleId, "Lifegain", "on");
    deck = setTagOverride(deck, seer.card.oracleId, "Sacrifice", "off");
    const dc = deck.cards.find((d) => d.card.name === "Viscera Seer")!;
    const roles = effectiveRoles(dc);
    const added = roles.find((r) => r.value === "Card Draw");
    expect(added?.manual).toBe(true);
    expect(added?.confidence).toBe(1);
    expect(roles.map((r) => r.value)).not.toContain("Sacrifice Outlets");
    const tags = effectiveTags(dc).map((t) => t.value);
    expect(tags).toContain("Lifegain");
    expect(tags).not.toContain("Sacrifice");
    // Restoring "auto" removes the override.
    deck = setTagOverride(deck, seer.card.oracleId, "Sacrifice", "auto");
    expect(effectiveTags(deck.cards.find((d) => d.card.name === "Viscera Seer")!).map((t) => t.value)).toContain("Sacrifice");
  });
});
