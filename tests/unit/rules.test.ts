import { describe, expect, it } from "vitest";
import { canBeCommander, canPairCommanders, commanderIdentity, copyLimit, validateDeck } from "@/lib/rules/commander";
import { addCard } from "@/lib/deck/operations";
import { deckFromText, fixtureCard } from "./helpers";

describe("commander rules", () => {
  const frodo = fixtureCard("Frodo, Adventurous Hobbit");
  const sam = fixtureCard("Sam, Loyal Attendant");

  it("recognizes Frodo and Sam as Partner-with commanders", () => {
    expect(canBeCommander(frodo)).toBe(true);
    expect(canPairCommanders(frodo, sam)).toBe(true);
    expect(canPairCommanders(frodo, fixtureCard("Samwise Gamgee"))).toBe(false);
    expect(commanderIdentity([frodo, sam])).toEqual(["W", "B", "G"]);
  });

  it("rejects non-legendary commanders", () => {
    expect(canBeCommander(fixtureCard("Soul Warden"))).toBe(false);
  });

  it("allows unlimited basics", () => {
    expect(copyLimit(fixtureCard("Forest"))).toBe(Infinity);
    expect(copyLimit(fixtureCard("Sol Ring"))).toBe(1);
  });

  it("validates the sample deck as legal", () => {
    const deck = deckFromText();
    expect(deck.unresolved).toEqual([]);
    expect(validateDeck(deck)).toEqual([]);
  });

  it("flags size, singleton, identity and legality problems", () => {
    let deck = deckFromText();
    deck = addCard(deck, fixtureCard("Sol Ring"));
    deck = addCard(deck, fixtureCard("Grim Lavamancer"));
    deck = addCard(deck, fixtureCard("Mana Crypt"));
    const codes = validateDeck(deck).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["deck-size", "singleton", "color-identity", "illegal"]));
  });
});
