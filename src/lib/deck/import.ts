import type { Card, Deck } from "@/lib/types";
import { createDeck, importEntries, setCommanders } from "./operations";
import { parseDecklist, type ParseError } from "./parser";
import { resolveEntries } from "./resolve";

export interface ImportResult {
  deck: Deck;
  parseErrors: ParseError[];
  resolvedCount: number;
}

/**
 * Parse + resolve a pasted decklist into a deck. Explicitly chosen commanders
 * win over any "Commander" section in the text.
 */
export async function importDecklist(
  text: string,
  opts: { base?: Deck; name?: string; commanders?: Card[]; replace?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportResult> {
  const { entries, errors } = parseDecklist(text);
  const { resolved, unresolved } = await resolveEntries(entries, opts.onProgress);
  let deck = opts.base ?? createDeck(opts.name ?? "New Deck");
  if (opts.commanders?.length) deck = setCommanders(deck, opts.commanders);
  const hasExplicit = !!opts.commanders?.length;
  // When commanders were picked explicitly, a "Commander" section just re-lists them.
  const adjusted = hasExplicit
    ? resolved.map((r) =>
        r.entry.section === "commander" && !opts.commanders!.some((c) => c.oracleId === r.card.oracleId)
          ? { ...r, entry: { ...r.entry, section: "main" as const } }
          : r,
      )
    : resolved;
  deck = importEntries(deck, adjusted, unresolved, { replace: opts.replace });
  if (hasExplicit) deck = setCommanders(deck, opts.commanders!);
  return { deck, parseErrors: errors, resolvedCount: resolved.length };
}
