import { describe, expect, it } from "vitest";
import { analyzeMana, hasLandBackFace, landColors, landEntersTapped, suggestLandRange } from "@/lib/analysis/mana";
import { countPips } from "@/lib/cards/helpers";
import { deckFromText, fixtureCard } from "./helpers";
import { makeCard } from "./phase2-helpers";

const demand = (report: ReturnType<typeof analyzeMana>, color: string) => report.demand.find((d) => d.color === color)!;

describe("mana base doctor", () => {
  it("counts hybrid pips as half of each color and Phyrexian pips as the color", () => {
    const hybrid = makeCard({ name: "Hybrid Test", mana_cost: "{W/B}{W/B}", colors: ["W", "B"], color_identity: ["W", "B"] });
    expect(countPips(hybrid.manaCost).W).toBe(1);
    expect(countPips(hybrid.manaCost).B).toBe(1);
    const phyrexian = makeCard({ name: "Phyrexian Test", mana_cost: "{1}{G/P}", colors: ["G"], color_identity: ["G"] });
    expect(countPips(phyrexian.manaCost).G).toBe(1);
    const report = analyzeMana([hybrid, phyrexian, fixtureCard("Plains"), fixtureCard("Swamp"), fixtureCard("Forest")], ["W", "B", "G"]);
    expect(demand(report, "W").pips).toBe(1);
    expect(demand(report, "B").pips).toBe(1);
    expect(demand(report, "G").pips).toBe(1);
  });

  it("recognises MDFC land faces, multicolor lands and colorless producers", () => {
    const mdfc = makeCard({
      name: "Spell // Land",
      layout: "modal_dfc",
      color_identity: ["G"],
      colors: ["G"],
      card_faces: [
        { name: "Spell", mana_cost: "{1}{G}", type_line: "Instant", oracle_text: "Draw a card." },
        { name: "Land", type_line: "Land", oracle_text: "As Land enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {G}." },
      ],
    });
    expect(hasLandBackFace(mdfc)).toBe(true);
    const shock = fixtureCard("Temple Garden");
    expect(landColors(shock, ["G", "W"])).toEqual(expect.arrayContaining(["G", "W"]));
    expect(landEntersTapped(shock)).toBe("sometimes");
    expect(landEntersTapped(fixtureCard("Jungle Hollow"))).toBe("yes");
    expect(landEntersTapped(fixtureCard("Forest"))).toBe("no");
    const report = analyzeMana([mdfc, shock, fixtureCard("Sol Ring"), fixtureCard("Evolving Wilds"), fixtureCard("Isolated Chapel")], ["W", "B", "G"]);
    expect(report.breakdown.mdfcLands).toBe(1);
    expect(report.breakdown.manaRocks).toBe(1);
    expect(report.breakdown.conditionalLands).toBeGreaterThanOrEqual(2);
    // Evolving Wilds fetches any basic in identity.
    expect(landColors(fixtureCard("Evolving Wilds"), ["W", "B", "G"])).toEqual(["W", "B", "G"]);
  });

  it("flags a color whose pip share is far above its source share, in tentative language", () => {
    const cards = [
      ...Array.from({ length: 6 }, (_, i) => makeCard({ name: `Black spell ${i}`, mana_cost: "{B}{B}", colors: ["B"], color_identity: ["B"], type_line: "Sorcery" })),
      makeCard({ name: "Green spell", mana_cost: "{G}", colors: ["G"], color_identity: ["G"], type_line: "Sorcery" }),
      ...Array.from({ length: 8 }, () => fixtureCard("Forest")),
      fixtureCard("Swamp"),
    ];
    const report = analyzeMana(cards, ["B", "G"]);
    const black = demand(report, "B");
    expect(black.gap).toBeGreaterThan(0.12);
    const concern = report.concerns.find((c) => /black/i.test(c.title + c.detail));
    expect(concern).toBeDefined();
    expect(concern!.detail).toMatch(/may be under-supplied|approximately/i);
    expect(concern!.detail).not.toMatch(/\bmust\b|\bbroken\b/i);
  });

  it("reports the sample deck with balanced colors and a sensible land range", () => {
    const deck = deckFromText();
    const cards = deck.cards.flatMap((d) => Array.from({ length: d.quantity }, () => d.card));
    const report = analyzeMana(cards, ["W", "B", "G"]);
    expect(report.landCount).toBe(36);
    expect(report.demand.map((d) => d.color)).toEqual(["W", "B", "G"]);
    expect(report.suggestedLands.low).toBeLessThanOrEqual(36);
    expect(report.suggestedLands.high + 2).toBeGreaterThanOrEqual(36);
    expect(report.concerns.filter((c) => c.severity === "warning")).toHaveLength(0);
  });

  it("lowers the suggested land count with more ramp and a lower curve", () => {
    const slow = suggestLandRange(3.6, 0);
    const fast = suggestLandRange(2.4, 12);
    expect(fast.low).toBeLessThan(slow.low);
    expect(fast.high).toBeLessThan(slow.high);
  });
});
