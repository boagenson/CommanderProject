/**
 * Combo detection. Definitions come from one or more `ComboSource`s; the
 * built-in list ships with the app and an external source can be registered
 * later (for example a fetched Commander Spellbook dataset). Detection is a
 * name match against the deck, so it never invents combos from card text.
 *
 * A "near" combo has every required card but one, which the Upgrade Workshop
 * can use to suggest completing it.
 */
import type { ComboDefinition, ComboType, DetectedCombo } from "@/lib/types";
import { BUILT_IN_COMBOS } from "./definitions";

export interface ComboSource {
  id: string;
  definitions(): ComboDefinition[];
}

export const builtInComboSource: ComboSource = {
  id: "built-in",
  definitions: () => BUILT_IN_COMBOS.map((c) => ({ ...c, source: c.source ?? "built-in" })),
};

const sources: ComboSource[] = [builtInComboSource];

/** Register an additional combo source (e.g. an imported dataset). */
export function registerComboSource(source: ComboSource) {
  if (!sources.some((s) => s.id === source.id)) sources.push(source);
}

export function allComboDefinitions(): ComboDefinition[] {
  const seen = new Set<string>();
  const out: ComboDefinition[] = [];
  for (const s of sources) {
    for (const d of s.definitions()) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

const norm = (name: string) => name.toLowerCase().split(" // ")[0].trim();

/**
 * Find combos in a list of card names. `includeNear` also returns combos
 * missing exactly one required card.
 */
export function findCombos(cardNames: Iterable<string>, opts: { includeNear?: boolean; definitions?: ComboDefinition[] } = {}): DetectedCombo[] {
  const have = new Set([...cardNames].map(norm));
  const out: DetectedCombo[] = [];
  for (const def of opts.definitions ?? allComboDefinitions()) {
    const present = def.required.filter((n) => have.has(norm(n)));
    const missing = def.required.filter((n) => !have.has(norm(n)));
    const optionalPresent = (def.optional ?? []).filter((n) => have.has(norm(n)));
    if (!missing.length) {
      out.push({ definition: def, type: def.type, present, missing, optionalPresent });
    } else if (opts.includeNear && missing.length === 1 && present.length >= 1) {
      out.push({ definition: def, type: "near", present, missing, optionalPresent });
    }
  }
  const order: Record<ComboType, number> = { infinite: 0, engine: 1, synergy: 2, near: 3 };
  return out.sort((a, b) => order[a.type] - order[b.type] || a.definition.name.localeCompare(b.definition.name));
}

export const COMBO_TYPE_LABELS: Record<ComboType, string> = {
  infinite: "Infinite Combo",
  engine: "Value Engine",
  synergy: "Strong Synergy",
  near: "Near-Combo",
};
