import { describe, expect, it } from "vitest";
import { parseDecklist } from "@/lib/deck/parser";
import { SAMPLE_DECKLIST } from "@/lib/deck/sample";

describe("parseDecklist", () => {
  it("parses plain quantity + name lines", () => {
    const { entries, errors } = parseDecklist("1 Sol Ring\n1 Birds of Paradise\n1x Academy Manufactor\nSwords to Plowshares");
    expect(errors).toEqual([]);
    expect(entries.map((e) => [e.quantity, e.name])).toEqual([
      [1, "Sol Ring"],
      [1, "Birds of Paradise"],
      [1, "Academy Manufactor"],
      [1, "Swords to Plowshares"],
    ]);
  });

  it("parses set codes and collector numbers", () => {
    const { entries } = parseDecklist("1 Frodo, Adventurous Hobbit (LTC) 2\n1 Sam, Loyal Attendant (LTC) 90\n1 Sol Ring [C21]");
    expect(entries[0]).toMatchObject({ name: "Frodo, Adventurous Hobbit", set: "ltc", collectorNumber: "2" });
    expect(entries[1]).toMatchObject({ name: "Sam, Loyal Attendant", set: "ltc", collectorNumber: "90" });
    expect(entries[2]).toMatchObject({ name: "Sol Ring", set: "c21" });
  });

  it("handles section headers, foil markers, tags and CMDR markers", () => {
    const text = `Commander
1 Frodo, Adventurous Hobbit
// Mainboard
1 Sol Ring (C21) 263 *F*
1x Cultivate (cmr) 472 [Ramp] ^Have,#37d67a^
1 Sam, Loyal Attendant *CMDR*

Sideboard
1 Toxic Deluge`;
    const { entries } = parseDecklist(text);
    expect(entries.map((e) => [e.name, e.section])).toEqual([
      ["Frodo, Adventurous Hobbit", "commander"],
      ["Sol Ring", "main"],
      ["Cultivate", "main"],
      ["Sam, Loyal Attendant", "commander"],
      ["Toxic Deluge", "maybe"],
    ]);
    expect(entries[1]).toMatchObject({ set: "c21", collectorNumber: "263" });
  });

  it("reports unreadable lines instead of throwing", () => {
    const { entries, errors } = parseDecklist("1 Sol Ring\n0 Nothing\n999 Too Many");
    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it("parses the sample deck to 100 cards", () => {
    const { entries, errors } = parseDecklist(SAMPLE_DECKLIST);
    expect(errors).toEqual([]);
    expect(entries.reduce((n, e) => n + e.quantity, 0)).toBe(100);
    expect(entries.filter((e) => e.section === "commander")).toHaveLength(2);
  });
});
