/**
 * Synergy packages: groups of cards that function together, derived from the
 * detected themes. A package lists enablers (make the resource), payoffs
 * (reward it) and support (cards tagged with the mechanic that do neither,
 * such as tutors or protection for the engine) and explains its purpose.
 */
import type { Classification, DeckTheme, DetectedCombo, SynergyPackage, ThematicTag } from "@/lib/types";

export const PACKAGE_NAMES: Record<string, string> = {
  food: "Food Engine",
  treasure: "Treasure Package",
  clues: "Clue Package",
  artifacts: "Artifact Package",
  tokens: "Token Package",
  counters: "+1/+1 Counters Package",
  lifegain: "Lifegain Package",
  aristocrats: "Aristocrats Package",
  sacrifice: "Sacrifice Package",
  graveyard: "Graveyard Package",
  spellslinger: "Spellslinger Package",
  equipment: "Equipment Package",
  enchantments: "Enchantress Package",
  landfall: "Landfall Package",
};

const PACKAGE_PURPOSE: Record<string, string> = {
  food: "Generate Food repeatedly, then cash it in for life, cards, or sacrifice triggers instead of only 3 life.",
  treasure: "Turn Treasure into both ramp and sacrifice fodder so the deck accelerates while triggering artifact payoffs.",
  clues: "Convert Clues into a steady stream of cards and artifact triggers.",
  artifacts: "Keep artifacts entering and leaving so artifact-count and artifact-ETB payoffs keep firing.",
  tokens: "Put many bodies on the board and reward width with anthems, drain or draw.",
  counters: "Stack +1/+1 counters and multiply them into oversized threats.",
  lifegain: "Gain life in many small increments so each instance triggers the payoffs; small repeatable gains beat one large gain.",
  aristocrats: "Feed creatures to sacrifice outlets so death triggers drain opponents and draw cards.",
  sacrifice: "Use free sacrifice outlets to turn permanents into value on demand and dodge removal.",
  graveyard: "Fill the graveyard, then recur or reanimate the best pieces.",
  spellslinger: "Chain instants and sorceries to trigger spell-count payoffs.",
  equipment: "Suit up one or two creatures and protect them.",
  enchantments: "Play enchantments for constellation and enchantment-count payoffs.",
  landfall: "Make extra land drops so each one triggers landfall.",
};

const THEME_TAGS: Record<string, ThematicTag[]> = {
  food: ["Food"],
  treasure: ["Treasure"],
  clues: ["Clue"],
  artifacts: ["Artifact"],
  tokens: ["Token"],
  counters: ["Counters"],
  lifegain: ["Lifegain"],
  aristocrats: ["Death Trigger", "Sacrifice"],
  sacrifice: ["Sacrifice"],
  graveyard: ["Graveyard"],
  spellslinger: ["Spells"],
  equipment: ["Equipment"],
  enchantments: ["Enchantment"],
  landfall: ["Landfall"],
};

export const MIN_PACKAGE_SCORE = 18;

export function detectPackages(themes: DeckTheme[], tags: Map<string, Classification<ThematicTag>[]>, combos: DetectedCombo[]): SynergyPackage[] {
  const out: SynergyPackage[] = [];
  for (const theme of themes) {
    if (theme.score < MIN_PACKAGE_SCORE) continue;
    const enablers = theme.cards.filter((c) => c.role !== "payoff").map((c) => c.name);
    const payoffs = theme.cards.filter((c) => c.role !== "enabler").map((c) => c.name);
    const members = new Set(theme.cards.map((c) => c.name));
    const wanted = new Set(THEME_TAGS[theme.id] ?? []);
    const support: string[] = [];
    for (const [name, list] of tags) {
      if (members.has(name)) continue;
      if (list.some((t) => wanted.has(t.value) && t.confidence >= 0.6)) support.push(name);
    }
    // Completeness: needs both sides to count as a package.
    const completeness = Math.min(1, enablers.length / 3) * 0.5 + Math.min(1, payoffs.length / 2) * 0.5;
    const comboBoost = combos.filter((c) => c.type !== "near" && [...c.present].some((n) => members.has(n))).length * 6;
    const strength = Math.min(100, Math.round(theme.score * (0.6 + 0.4 * completeness) + comboBoost));
    const typal = theme.id.startsWith("typal-");
    out.push({
      id: theme.id,
      name: PACKAGE_NAMES[theme.id] ?? (typal ? `${theme.name} Package` : `${theme.name} Package`),
      strength,
      purpose: PACKAGE_PURPOSE[theme.id] ?? (typal ? `Assemble ${theme.name.replace(/ Typal$/, "")} creatures and the cards that reward them.` : theme.description),
      enablers,
      payoffs,
      support: support.slice(0, 12),
      themes: [theme.id],
    });
  }
  return out.sort((a, b) => b.strength - a.strength);
}
