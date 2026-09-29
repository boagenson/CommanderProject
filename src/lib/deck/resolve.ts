/**
 * Resolve parsed decklist entries to Scryfall cards.
 *
 * Strategy (fewest requests first):
 *  1. One /cards/collection batch per 75 entries, using set + collector number
 *     when present, then name + set, then bare name.
 *  2. Entries whose printing wasn't found are retried by bare name.
 *  3. Anything still missing gets a fuzzy lookup (handles typos).
 * One bad card never fails the whole import; it is reported as unresolved.
 */
import type { Card, UnresolvedCard } from "@/lib/types";
import {
  describeScryfallError,
  getCardFuzzy,
  getCollection,
  ScryfallApiError,
} from "@/lib/scryfall";
import type { ScryfallIdentifier } from "@/lib/scryfall/types";
import { frontFaceName, type ParsedEntry } from "./parser";

export interface ResolvedEntry {
  entry: ParsedEntry;
  card: Card;
}

export interface ResolveResult {
  resolved: ResolvedEntry[];
  unresolved: UnresolvedCard[];
}

const MAX_FUZZY = 25;
const norm = (s: string) => s.trim().toLowerCase();

function identifierFor(e: ParsedEntry): ScryfallIdentifier {
  if (e.set && e.collectorNumber) return { set: e.set, collector_number: e.collectorNumber };
  if (e.set) return { name: frontFaceName(e.name), set: e.set };
  return { name: frontFaceName(e.name) };
}

function indexCards(cards: Card[]) {
  const byName = new Map<string, Card>();
  const byPrint = new Map<string, Card>();
  for (const c of cards) {
    byName.set(norm(c.name), c);
    byName.set(norm(frontFaceName(c.name)), c);
    byPrint.set(`${c.set}|${c.collectorNumber}`.toLowerCase(), c);
  }
  return { byName, byPrint };
}

function match(e: ParsedEntry, idx: ReturnType<typeof indexCards>): Card | undefined {
  if (e.set && e.collectorNumber) {
    const byPrint = idx.byPrint.get(`${e.set}|${e.collectorNumber}`.toLowerCase());
    // Ensure the printing is actually the named card (guards against typos in numbers).
    if (byPrint && (norm(byPrint.name) === norm(e.name) || norm(frontFaceName(byPrint.name)) === norm(frontFaceName(e.name)))) {
      return byPrint;
    }
  }
  // A different printing of the named card is acceptable.
  return idx.byName.get(norm(e.name)) ?? idx.byName.get(norm(frontFaceName(e.name)));
}

export async function resolveEntries(
  entries: ParsedEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<ResolveResult> {
  const resolved: ResolvedEntry[] = [];
  const unresolved: UnresolvedCard[] = [];
  if (!entries.length) return { resolved, unresolved };

  let pending = entries;

  // Pass 1 & 2: collection lookups (specific printing, then bare name).
  for (const pass of [0, 1] as const) {
    if (!pending.length) break;
    const identifiers = pending.map((e) => (pass === 0 ? identifierFor(e) : { name: frontFaceName(e.name) }));
    const unique = dedupeIdentifiers(identifiers);
    let found: Card[] = [];
    try {
      found = (await getCollection(unique)).found;
    } catch (err) {
      // Network failure: report everything still pending as unresolved.
      const reason = describeScryfallError(err);
      for (const e of pending) unresolved.push(toUnresolved(e, reason));
      return { resolved, unresolved };
    }
    const idx = indexCards(found);
    const next: ParsedEntry[] = [];
    for (const e of pending) {
      const card = match(e, idx);
      if (card) resolved.push({ entry: e, card });
      else next.push(e);
    }
    pending = next;
    onProgress?.(entries.length - pending.length, entries.length);
  }

  // Pass 3: fuzzy lookups for typos.
  for (const [i, e] of pending.entries()) {
    if (i >= MAX_FUZZY) {
      unresolved.push(toUnresolved(e, "Not found (too many unknown cards to fuzzy-match)."));
      continue;
    }
    try {
      const card = await getCardFuzzy(e.name);
      resolved.push({ entry: e, card });
    } catch (err) {
      const reason =
        err instanceof ScryfallApiError && err.status === 404
          ? "No card with this name was found on Scryfall."
          : describeScryfallError(err);
      unresolved.push(toUnresolved(e, reason));
    }
    onProgress?.(entries.length - pending.length + i + 1, entries.length);
  }

  // Keep original line order.
  resolved.sort((a, b) => a.entry.lineNumber - b.entry.lineNumber);
  return { resolved, unresolved };
}

function toUnresolved(e: ParsedEntry, reason: string): UnresolvedCard {
  return { line: e.line.trim(), name: e.name, quantity: e.quantity, reason };
}

function dedupeIdentifiers(ids: ScryfallIdentifier[]) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = JSON.stringify(id).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
