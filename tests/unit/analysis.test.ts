import { describe, expect, it } from "vitest";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { classifyCard } from "@/lib/analysis/categories";
import { cardThemeRoles } from "@/lib/synergy/engine";
import { setCategoryOverride } from "@/lib/deck/operations";
import { deckFromText, fixtureCard } from "./helpers";

const cats = (name: string) => classifyCard(fixtureCard(name)).map((m) => m.category);

describe("functional categories", () => {
  it.each([
    ["Sol Ring", "Ramp"],
    ["Cultivate", "Ramp"],
    ["Harmonize", "Card Draw"],
    ["Tireless Tracker", "Card Draw"],
    ["Swords to Plowshares", "Targeted Removal"],
    ["Beast Within", "Targeted Removal"],
    ["Wrath of God", "Board Wipes"],
    ["Heroic Intervention", "Protection"],
    ["Teferi's Protection", "Protection"],
    ["Eternal Witness", "Graveyard Recursion"],
    ["Demonic Tutor", "Tutors"],
    ["Worldly Tutor", "Tutors"],
    ["Farmer Cotton", "Token Generation"],
    ["Soul Warden", "Lifegain"],
    ["Viscera Seer", "Sacrifice Outlets"],
    ["Sanguine Bond", "Finishers"],
    ["Blood Artist", "Finishers"],
    ["Bastion of Remembrance", "Finishers"],
  ] as const)("%s → %s", (name, category) => {
    expect(cats(name)).toContain(category);
  });

  it("only counts tokens the card makes for you", () => {
    expect(cats("Beast Within")).not.toContain("Token Generation"); // the opponent gets the token
    expect(cats("Generous Gift")).not.toContain("Token Generation");
    expect(cats("Parallel Lives")).not.toContain("Token Generation"); // doubler, not a maker
    expect(cats("Mirkwood Bats")).not.toContain("Token Generation"); // reacts to tokens
  });

  it("does not treat land searches as tutors", () => {
    expect(cats("Cultivate")).not.toContain("Tutors");
    expect(cats("Wrath of God")).not.toContain("Targeted Removal");
  });
});

describe("analyzeDeck on the Frodo & Sam sample", () => {
  const deck = deckFromText();
  const a = analyzeDeck(deck);

  it("counts cards, lands and curve without lands", () => {
    expect(a.totalCards).toBe(100);
    expect(a.landCount).toBe(36);
    expect(a.manaCurve.reduce((n, r) => n + r.count, 0)).toBe(64);
    expect(a.averageManaValue).toBeGreaterThan(1.5);
    expect(a.averageManaValue).toBeLessThan(4);
  });

  it("finds ramp, draw and removal", () => {
    expect(a.categories.Ramp.length).toBeGreaterThanOrEqual(10);
    expect(a.categories["Card Draw"].length).toBeGreaterThanOrEqual(5);
    expect(a.categories["Targeted Removal"].length).toBeGreaterThanOrEqual(7);
    expect(a.categories["Board Wipes"]).toEqual(expect.arrayContaining(["Wrath of God", "Damnation"]));
  });

  it("detects Food, lifegain and artifact-token themes", () => {
    const ids = a.themes.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["food", "lifegain", "artifacts", "treasure", "tokens", "aristocrats"]));
    const food = a.themes.find((t) => t.id === "food")!;
    expect(food.score).toBeGreaterThan(40);
    expect(food.cards.map((c) => c.name)).toContain("Sam, Loyal Attendant");
  });

  it("explains Academy Manufactor's interaction with Food/Treasure/Clue makers", () => {
    const interaction = a.themes
      .flatMap((t) => t.interactions)
      .find((i) => i.ruleId === "artifact-token-replacement")!;
    expect(interaction).toBeDefined();
    expect(interaction.sources).toEqual(["Academy Manufactor"]);
    expect(interaction.targets).toEqual(expect.arrayContaining(["Sam, Loyal Attendant", "Gilded Goose", "Tireless Tracker", "Smothering Tithe"]));
    expect(interaction.explanation).toMatch(/one of each/);
  });

  it("detects the Sanguine Bond + Exquisite Blood loop", () => {
    const loop = a.themes.flatMap((t) => t.interactions).find((i) => i.ruleId === "lifegain-drain-loop");
    expect(loop?.sources).toContain("Sanguine Bond");
    expect(loop?.targets).toContain("Exquisite Blood");
  });

  it("detects Halfling typal", () => {
    expect(a.themes.some((t) => t.id === "typal-halfling")).toBe(true);
  });

  it("computes mana production against pips", () => {
    expect(a.manaProduction.sources.G).toBeGreaterThan(10);
    expect(a.manaProduction.pips.W).toBeGreaterThan(0);
    expect(a.manaProduction.mismatches.map((m) => m.color)).toEqual(["W", "B", "G"]);
  });
});

describe("theme roles", () => {
  const roles = (name: string) => Object.fromEntries(cardThemeRoles(fixtureCard(name)).map((r) => [r.themeId, r.role]));

  it.each(["Blood Artist", "Zulaport Cutthroat", "Cruel Celebrant"])("%s is an aristocrats payoff", (name) => {
    expect(["payoff", "both"]).toContain(roles(name).aristocrats);
  });

  it("counts Food artifacts as Food enablers", () => {
    expect(roles("Heaped Harvest").food).toBeDefined();
  });

  it("does not read Teferi's Protection as a lifegain payoff", () => {
    expect(roles("Teferi's Protection").lifegain).toBeUndefined();
  });

  it("pairs sacrifice outlets with self-referencing death triggers", () => {
    const a = analyzeDeck(deckFromText());
    const combo = a.themes.flatMap((t) => t.interactions).find((i) => i.ruleId === "sac-outlet-death-trigger");
    expect(combo?.targets).toEqual(expect.arrayContaining(["Blood Artist", "Zulaport Cutthroat"]));
  });
});

describe("manual category corrections", () => {
  it("applies to commanders too", () => {
    const deck = deckFromText();
    const sam = deck.commanders.find((c) => c.card.name.startsWith("Sam"))!;
    const next = setCategoryOverride(deck, sam.card.oracleId, "Ramp", "on");
    expect(analyzeDeck(next).categories.Ramp).toContain(sam.card.name);
    expect(analyzeDeck(deck).categories.Ramp).not.toContain(sam.card.name);
  });
});
