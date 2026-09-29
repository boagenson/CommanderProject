/**
 * High-level Scryfall service used by the rest of the app.
 * All functions return normalized `Card`s and populate the persistent cache.
 */
import type { Card } from "@/lib/types";
import { putCards, getCachedByName, cacheKey } from "./card-cache";
import { ScryfallApiError, scryfallRequest } from "./client";
import { normalizeCard } from "./normalize";
import type {
  ScryfallCard,
  ScryfallCatalog,
  ScryfallIdentifier,
  ScryfallList,
  ScryfallSet,
} from "./types";

const COLLECTION_BATCH = 75;

function remember(raw: ScryfallCard[]): Card[] {
  const cards = raw.map(normalizeCard);
  putCards(cards);
  return cards;
}

/** Exact name lookup, optionally pinned to a set. */
export async function getCardByName(name: string, set?: string): Promise<Card> {
  const cached = getCachedByName(name);
  if (cached && (!set || cached.set === set.toLowerCase())) return cached;
  const params = new URLSearchParams({ exact: name });
  if (set) params.set("set", set);
  const raw = await scryfallRequest<ScryfallCard>(`/cards/named?${params}`);
  return remember([raw])[0];
}

/** Fuzzy name lookup: tolerates typos and partial names. */
export async function getCardFuzzy(name: string): Promise<Card> {
  const cached = getCachedByName(name);
  if (cached) return cached;
  const raw = await scryfallRequest<ScryfallCard>(`/cards/named?fuzzy=${encodeURIComponent(name)}`);
  return remember([raw])[0];
}

export async function getCardById(id: string): Promise<Card> {
  const raw = await scryfallRequest<ScryfallCard>(`/cards/${encodeURIComponent(id)}`);
  return remember([raw])[0];
}

export interface CollectionResult {
  found: Card[];
  notFound: ScryfallIdentifier[];
}

/**
 * Resolve many identifiers with as few requests as possible
 * (Scryfall's /cards/collection accepts 75 identifiers per call).
 * Cached cards are served locally.
 */
export async function getCollection(identifiers: ScryfallIdentifier[]): Promise<CollectionResult> {
  const found: Card[] = [];
  const pending: ScryfallIdentifier[] = [];
  for (const ident of identifiers) {
    if ("name" in ident) {
      const cached = getCachedByName(ident.name);
      if (cached && (!("set" in ident) || cached.set === ident.set.toLowerCase())) {
        found.push(cached);
        continue;
      }
    }
    pending.push(ident);
  }

  const notFound: ScryfallIdentifier[] = [];
  for (let i = 0; i < pending.length; i += COLLECTION_BATCH) {
    const batch = pending.slice(i, i + COLLECTION_BATCH);
    const res = await scryfallRequest<ScryfallList<ScryfallCard>>("/cards/collection", {
      method: "POST",
      body: { identifiers: batch },
    });
    found.push(...remember(res.data));
    notFound.push(...(res.not_found ?? []));
  }
  return { found, notFound };
}

export interface SearchOptions {
  page?: number;
  order?: "name" | "edhrec" | "cmc" | "usd" | "released" | "rarity";
  dir?: "auto" | "asc" | "desc";
  unique?: "cards" | "prints" | "art";
  signal?: AbortSignal;
}

export interface SearchResult {
  cards: Card[];
  total: number;
  hasMore: boolean;
  warnings: string[];
}

/** Full-text Scryfall search. A query with no results returns an empty list. */
export async function searchCards(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(opts.page ?? 1),
    order: opts.order ?? "edhrec",
    dir: opts.dir ?? "auto",
    unique: opts.unique ?? "cards",
  });
  try {
    const res = await scryfallRequest<ScryfallList<ScryfallCard>>(`/cards/search?${params}`, {
      signal: opts.signal,
    });
    return {
      cards: remember(res.data),
      total: res.total_cards ?? res.data.length,
      hasMore: res.has_more,
      warnings: res.warnings ?? [],
    };
  } catch (err) {
    if (err instanceof ScryfallApiError && err.status === 404) {
      return { cards: [], total: 0, hasMore: false, warnings: [] };
    }
    throw err;
  }
}

/** Card name autocomplete (up to 20 names). */
export async function autocomplete(q: string, signal?: AbortSignal): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const res = await scryfallRequest<ScryfallCatalog>(
    `/cards/autocomplete?q=${encodeURIComponent(q.trim())}`,
    { signal },
  );
  return res.data;
}

let setsPromise: Promise<ScryfallSet[]> | null = null;
/** All sets, fetched once per session. */
export function getSets(): Promise<ScryfallSet[]> {
  setsPromise ??= scryfallRequest<ScryfallList<ScryfallSet>>("/sets")
    .then((r) => r.data)
    .catch((e) => {
      setsPromise = null;
      throw e;
    });
  return setsPromise;
}

export { cacheKey };
