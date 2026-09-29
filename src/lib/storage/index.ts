import { LocalDeckRepository, LocalPreferencesRepository } from "./local";
import type { Repositories } from "./repository";

let repos: Repositories | null = null;

/**
 * The active storage backend. Replace the implementations here (for example
 * with Supabase-backed repositories) to move decks to a real database.
 */
export function getRepositories(): Repositories {
  repos ??= { decks: new LocalDeckRepository(), preferences: new LocalPreferencesRepository() };
  return repos;
}

export type { DeckRepository, PreferencesRepository, Repositories } from "./repository";
export { exportAllData, importAllData, StorageQuotaError } from "./local";
