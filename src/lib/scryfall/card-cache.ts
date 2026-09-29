/**
 * Persistent cache of normalized cards keyed by id and lowercase name.
 * Lives in memory and is flushed to localStorage on a debounce so repeated
 * imports and page reloads don't re-request cards we already know.
 */
import type { Card } from "@/lib/types";

const STORAGE_KEY = "cw.cardCache.v1";
const MAX_ENTRIES = 1500;
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

let byId: Map<string, Card> | null = null;
const byName = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const cacheKey = (name: string) => name.trim().toLowerCase();

function load() {
  if (byId) return byId;
  byId = new Map();
  if (typeof window === "undefined") return byId;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cards = JSON.parse(raw) as Card[];
      const now = Date.now();
      for (const c of cards) {
        if (now - c.fetchedAt < TTL_MS) index(c);
      }
    }
  } catch {
    // Corrupt cache: start fresh.
  }
  return byId;
}

function index(card: Card) {
  byId!.delete(card.id);
  byId!.set(card.id, card);
  byName.set(cacheKey(card.name), card.id);
  // Double-faced cards are often typed by their front face name.
  const front = card.name.split(" // ")[0];
  if (front !== card.name) byName.set(cacheKey(front), card.id);
}

function scheduleFlush() {
  if (typeof window === "undefined" || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const cards = [...load().values()].slice(-MAX_ENTRIES);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // Quota exceeded: keep the most recent half.
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.slice(-MAX_ENTRIES / 2)));
      } catch {
        /* give up silently; cache is an optimization */
      }
    }
  }, 1000);
}

export function putCards(cards: Card[]) {
  load();
  for (const c of cards) index(c);
  scheduleFlush();
}

export function getCachedById(id: string): Card | undefined {
  return load().get(id);
}

export function getCachedByName(name: string): Card | undefined {
  load();
  const id = byName.get(cacheKey(name));
  return id ? byId!.get(id) : undefined;
}

export function clearCardCache() {
  byId = new Map();
  byName.clear();
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function cardCacheSize() {
  return load().size;
}
