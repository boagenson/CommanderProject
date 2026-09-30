"use client";

/**
 * Sandbox state per deck, kept in memory for the session so the Upgrade
 * Workshop can hand a package to the Sandbox tab. Nothing here is persisted;
 * the saved deck only changes when the user saves the sandbox explicitly.
 */
import { create } from "zustand";
import type { UpgradeSuggestion } from "@/lib/types";
import { applySwaps, EMPTY_SANDBOX, pushChange, redo, resetSandbox, undo, type SandboxChange, type SandboxState } from "@/lib/deck/sandbox";

interface SandboxStoreState {
  byDeck: Record<string, SandboxState>;
  get: (deckId: string) => SandboxState;
  push: (deckId: string, change: SandboxChange) => void;
  applyPackage: (deckId: string, swaps: UpgradeSuggestion[], label?: string) => void;
  undo: (deckId: string) => void;
  redo: (deckId: string) => void;
  reset: (deckId: string) => void;
}

export const useSandboxStore = create<SandboxStoreState>((set, get) => ({
  byDeck: {},
  get: (id) => get().byDeck[id] ?? EMPTY_SANDBOX,
  push: (id, change) => set((s) => ({ byDeck: { ...s.byDeck, [id]: pushChange(s.byDeck[id] ?? EMPTY_SANDBOX, change) } })),
  applyPackage: (id, swaps, label) => set((s) => ({ byDeck: { ...s.byDeck, [id]: applySwaps(s.byDeck[id] ?? EMPTY_SANDBOX, swaps, label) } })),
  undo: (id) => set((s) => ({ byDeck: { ...s.byDeck, [id]: undo(s.byDeck[id] ?? EMPTY_SANDBOX) } })),
  redo: (id) => set((s) => ({ byDeck: { ...s.byDeck, [id]: redo(s.byDeck[id] ?? EMPTY_SANDBOX) } })),
  reset: (id) => set((s) => ({ byDeck: { ...s.byDeck, [id]: resetSandbox() } })),
}));

export function useSandbox(deckId: string) {
  return useSandboxStore((s) => s.byDeck[deckId] ?? EMPTY_SANDBOX);
}
