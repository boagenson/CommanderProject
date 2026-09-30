import { describe, expect, it } from "vitest";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { parseGoals, priorityWeights } from "@/lib/deck/intent";
import { setIntent, setProtection } from "@/lib/deck/operations";
import { buildDoctorReport } from "@/lib/doctor";
import { buildContext, planSwaps, rankCuts, recommend } from "@/lib/upgrade";
import type { CandidatePool } from "@/lib/upgrade/candidates";
import { DEFAULT_INTENT, type UpgradeOptions } from "@/lib/types";
import { CANDIDATE_NAMES } from "../fixtures/cards";
import { deckFromText, fixtureCard } from "./helpers";

const pool = (): CandidatePool => {
  const cards = CANDIDATE_NAMES.map(fixtureCard);
  return { cards, rank: new Map(cards.map((c, i) => [c.oracleId, i / cards.length])), sources: new Map(), errors: [] };
};
const options: UpgradeOptions = { budget: 25, strategy: "Focused", goals: ["More Synergy"], maxSwaps: 6 };

describe("deck intent and goals", () => {
  it("parses natural-language goals deterministically", () => {
    const hints = parseGoals("Make it more consistent and keep the Lord of the Rings flavor. More food synergy, but don't turn it into generic good stuff. Not a combo deck.");
    expect(hints.consistency).toBe(true);
    expect(hints.flavor).toBe(true);
    expect(hints.avoidGeneric).toBe(true);
    expect(hints.boostThemes).toContain("food");
    expect(hints.strategies).not.toContain("Combo");
    expect(parseGoals("")).toMatchObject({ boostThemes: [], strategies: [], avoidGeneric: false });
  });

  it("turns priorities into weights", () => {
    const w = priorityWeights(["Budget", "Interaction"]);
    expect(w.budget).toBeGreaterThan(1);
    expect(w.interaction).toBeGreaterThan(1);
    expect(w.speed).toBe(1);
  });

  it("influences recommendations: avoid-generic under Preserve Theme lowers off-theme staples", () => {
    const deck = deckFromText();
    const analysis = analyzeDeck(deck);
    const neutral = recommend(deck, buildContext(deck, analysis, { ...options, intent: { ...DEFAULT_INTENT, philosophy: "Balanced" } }), pool());
    const themed = recommend(deck, buildContext(deck, analysis, { ...options, intent: { ...DEFAULT_INTENT, philosophy: "Preserve Theme", goals: "keep it on theme, no generic staples" } }), pool());
    const score = (recs: typeof neutral, name: string) => recs.find((r) => r.card.name === name)?.score ?? -Infinity;
    const staple = score(neutral, "Mana Crypt");
    if (staple !== -Infinity) expect(score(themed, "Mana Crypt")).toBeLessThan(staple);
    expect(score(themed, "Bartered Cow")).toBeGreaterThanOrEqual(score(neutral, "Bartered Cow") - 1e-9);
    for (const r of themed) expect(r.reasons.join(" ")).not.toMatch(/staple/i);
  });

  it("gives every recommendation and cut a deck-specific reason", () => {
    const deck = deckFromText();
    const analysis = analyzeDeck(deck);
    const ctx = buildContext(deck, analysis, options);
    const recs = recommend(deck, ctx, pool());
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) expect(r.reasons.length).toBeGreaterThan(0);
    const swaps = planSwaps(deck, ctx, recs);
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.explanation).toMatch(/\w+/);
      expect(s.removeReason).toMatch(/\w+/);
    }
  });

  it("stays within budget", () => {
    const deck = deckFromText();
    const analysis = analyzeDeck(deck);
    const ctx = buildContext(deck, analysis, { ...options, budget: 5, maxSwaps: 8 });
    const swaps = planSwaps(deck, ctx, recommend(deck, ctx, pool()));
    const spent = swaps.reduce((n, s) => n + (s.add.prices.usd ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(5 + 1e-9);
  });
});

describe("protected cards", () => {
  const base = deckFromText();
  const harmonize = fixtureCard("Harmonize").oracleId;

  it("never cuts locked cards, cuts favorites only under Maximum Optimization, and weighs flavor essentials", () => {
    const locked = setProtection(base, harmonize, "locked", true);
    const ctxL = buildContext(locked, analyzeDeck(locked), options);
    expect(rankCuts(locked.cards, ctxL).some((c) => c.deckCard.card.oracleId === harmonize)).toBe(false);

    const fav = setProtection(base, harmonize, "favorite", true);
    const ctxF = buildContext(fav, analyzeDeck(fav), { ...options, intent: { ...DEFAULT_INTENT, philosophy: "Balanced" } });
    expect(rankCuts(fav.cards, ctxF).some((c) => c.deckCard.card.oracleId === harmonize)).toBe(false);
    const ctxMax = buildContext(fav, analyzeDeck(fav), { ...options, intent: { ...DEFAULT_INTENT, philosophy: "Maximum Optimization" } });
    const cutsMax = rankCuts(fav.cards, ctxMax);
    const favCut = cutsMax.find((c) => c.deckCard.card.oracleId === harmonize);
    expect(favCut?.protection).toBe("favorite");
    const plain = rankCuts(base.cards, buildContext(base, analyzeDeck(base), options)).find((c) => c.deckCard.card.oracleId === harmonize)!;
    expect(favCut!.value).toBeGreaterThan(plain.value);

    const flavor = setProtection(base, harmonize, "flavor", true);
    const ctxFl = buildContext(flavor, analyzeDeck(flavor), options);
    const flavorCut = rankCuts(flavor.cards, ctxFl).find((c) => c.deckCard.card.oracleId === harmonize)!;
    expect(flavorCut.protection).toBe("flavor");
    expect(flavorCut.value).toBeGreaterThanOrEqual(plain.value);
  });

  it("commanders cannot be protected or cut", () => {
    const frodo = base.commanders[0].card.oracleId;
    expect(setProtection(base, frodo, "locked", true)).toBe(base);
  });
});

describe("deck doctor report", () => {
  it("reads the sample deck as a lifegain/food deck with combos and no disconnected cards", () => {
    const deck = deckFromText();
    const report = buildDoctorReport(deck, analyzeDeck(deck));
    expect(report.primary?.name).toBe("Lifegain");
    expect(report.secondary.map((s) => s.name)).toContain("Food");
    expect(report.combos.some((c) => c.type === "infinite")).toBe(true);
    const packageNames = report.packages.map((p) => p.name).join(" | ");
    expect(packageNames).toMatch(/Food/);
    expect(packageNames).toMatch(/Lifegain/);
    expect(report.disconnected).toEqual([]);
    expect(report.strengths.length).toBeGreaterThan(0);
    for (const w of report.weaknesses) expect(w.title + w.detail).not.toMatch(/\bbad\b|\bterrible\b/i);
  });

  it("notes when the stated intent disagrees with what was detected", () => {
    const deck = setIntent(deckFromText(), { ...DEFAULT_INTENT, primaryStrategy: "Spellslinger" });
    const report = buildDoctorReport(deck, analyzeDeck(deck));
    expect(report.intentNotes.length).toBeGreaterThan(0);
    expect(report.intentNotes[0]).toMatch(/Spellslinger/);
  });
});
