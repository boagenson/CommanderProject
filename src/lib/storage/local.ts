import type { Deck, Preferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import type { DeckRepository, PreferencesRepository } from "./repository";

const DECKS_KEY = "cw.decks.v1";
const PREFS_KEY = "cw.preferences.v1";

export class StorageQuotaError extends Error {
  constructor() {
    super("Browser storage is full. Delete unused decks or clear the card cache in Settings.");
    this.name = "StorageQuotaError";
  }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err instanceof DOMException && /quota/i.test(err.name + err.message)) throw new StorageQuotaError();
    throw err;
  }
}

/** Decks stored as one JSON map in localStorage. */
export class LocalDeckRepository implements DeckRepository {
  private all(): Record<string, Deck> {
    return read<Record<string, Deck>>(DECKS_KEY, {});
  }

  async list() {
    return Object.values(this.all()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string) {
    return this.all()[id] ?? null;
  }

  async save(deck: Deck) {
    const all = this.all();
    all[deck.id] = deck;
    write(DECKS_KEY, all);
    return deck;
  }

  async delete(id: string) {
    const all = this.all();
    delete all[id];
    write(DECKS_KEY, all);
  }

  subscribe(listener: () => void) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DECKS_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }
}

export class LocalPreferencesRepository implements PreferencesRepository {
  async get() {
    return { ...DEFAULT_PREFERENCES, ...read<Partial<Preferences>>(PREFS_KEY, {}) };
  }
  async save(prefs: Preferences) {
    write(PREFS_KEY, prefs);
    return prefs;
  }
}

/** Export/import of everything the app stores, for backups. */
export function exportAllData() {
  return JSON.stringify(
    { version: 1, decks: read(DECKS_KEY, {}), preferences: read(PREFS_KEY, {}) },
    null,
    2,
  );
}

export function importAllData(json: string): number {
  const data = JSON.parse(json) as { decks?: Record<string, Deck>; preferences?: Preferences };
  if (!data || typeof data !== "object" || !data.decks) throw new Error("That file isn't a Commander Workshop backup.");
  const existing = read<Record<string, Deck>>(DECKS_KEY, {});
  write(DECKS_KEY, { ...existing, ...data.decks });
  if (data.preferences) write(PREFS_KEY, data.preferences);
  return Object.keys(data.decks).length;
}
