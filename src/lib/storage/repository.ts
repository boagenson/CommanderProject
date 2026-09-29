/**
 * Storage abstraction. The UI only talks to these interfaces, so swapping
 * localStorage for Supabase/PostgreSQL means writing another implementation
 * (e.g. `SupabaseDeckRepository`) and returning it from `getRepositories()`.
 * Methods are async even for localStorage to match a network-backed store.
 */
import type { Deck, Preferences } from "@/lib/types";

export interface DeckSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface DeckRepository {
  list(): Promise<Deck[]>;
  get(id: string): Promise<Deck | null>;
  save(deck: Deck): Promise<Deck>;
  delete(id: string): Promise<void>;
  /** Subscribe to changes made elsewhere (other tabs, realtime). Returns an unsubscribe fn. */
  subscribe?(listener: () => void): () => void;
}

export interface PreferencesRepository {
  get(): Promise<Preferences>;
  save(prefs: Preferences): Promise<Preferences>;
}

export interface Repositories {
  decks: DeckRepository;
  preferences: PreferencesRepository;
}
