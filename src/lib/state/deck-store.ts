"use client";

/**
 * Client state for decks and preferences. Reads and writes go through the
 * repository layer (`lib/storage`), so this store doesn't care whether decks
 * live in localStorage or a remote database.
 */
import { create } from "zustand";
import type { Deck, Preferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { getRepositories } from "@/lib/storage";
import { toast } from "./toast-store";

interface DeckState {
  decks: Deck[];
  preferences: Preferences;
  loaded: boolean;
  load: () => Promise<void>;
  saveDeck: (deck: Deck) => Promise<void>;
  deleteDeck: (id: string) => Promise<Deck | undefined>;
  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
}

let loading: Promise<void> | null = null;

export const useDeckStore = create<DeckState>((set, get) => ({
  decks: [],
  preferences: DEFAULT_PREFERENCES,
  loaded: false,

  load: () => {
    loading ??= (async () => {
      const repos = getRepositories();
      const [decks, preferences] = await Promise.all([repos.decks.list(), repos.preferences.get()]);
      set({ decks, preferences, loaded: true });
      repos.decks.subscribe?.(async () => set({ decks: await repos.decks.list() }));
    })().catch((err) => {
      loading = null;
      set({ loaded: true });
      toast(`Couldn't load saved decks: ${(err as Error).message}`, "error");
    });
    return loading;
  },

  saveDeck: async (deck) => {
    const prev = get().decks;
    const others = prev.filter((d) => d.id !== deck.id);
    set({ decks: [deck, ...others].sort((a, b) => b.updatedAt - a.updatedAt) });
    try {
      await getRepositories().decks.save(deck);
    } catch (err) {
      set({ decks: prev });
      toast((err as Error).message || "Couldn't save the deck.", "error");
      throw err;
    }
  },

  deleteDeck: async (id) => {
    const deck = get().decks.find((d) => d.id === id);
    set({ decks: get().decks.filter((d) => d.id !== id) });
    await getRepositories().decks.delete(id);
    if (get().preferences.activeDeckId === id) await get().setPreferences({ activeDeckId: undefined });
    return deck;
  },

  setPreferences: async (patch) => {
    const preferences = { ...get().preferences, ...patch };
    set({ preferences });
    try {
      await getRepositories().preferences.save(preferences);
    } catch {
      toast("Couldn't save preferences.", "error");
    }
  },
}));

/** Store snapshot. Decks are loaded once by `AppProviders` on mount. */
export function useDecks() {
  return useDeckStore();
}

export function useDeckById(id: string | undefined) {
  const { decks, loaded } = useDecks();
  return { deck: id ? decks.find((d) => d.id === id) : undefined, loaded };
}
