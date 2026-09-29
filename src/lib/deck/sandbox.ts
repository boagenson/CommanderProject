/**
 * Deck Sandbox: an ordered list of reversible changes applied on top of a
 * saved deck. The saved deck is never mutated; `applySandbox` derives the
 * experimental deck, and callers compare `analyzeDeck(base)` with
 * `analyzeDeck(applySandbox(base, state))`. Undo pops the last change.
 */
import type { Card, Deck, UpgradeSuggestion } from "@/lib/types";
import { addCard, removeCard, setQuantity, swapCard } from "./operations";

export type SandboxChange =
  | { kind: "add"; card: Card; quantity: number }
  | { kind: "remove"; oracleId: string; name: string; quantity: number }
  | { kind: "swap"; remove: Card; add: Card; label?: string };

export interface SandboxState {
  changes: SandboxChange[];
  /** Changes undone and available to redo; cleared on a new change. */
  redo: SandboxChange[];
}

export const EMPTY_SANDBOX: SandboxState = { changes: [], redo: [] };

export function applySandbox(base: Deck, state: SandboxState): Deck {
  let deck = base;
  for (const ch of state.changes) {
    switch (ch.kind) {
      case "add":
        deck = addCard(deck, ch.card, ch.quantity);
        break;
      case "remove": {
        const dc = deck.cards.find((d) => d.card.oracleId === ch.oracleId && (d.board ?? "main") === "main");
        if (!dc) break;
        deck = dc.quantity > ch.quantity ? setQuantity(deck, ch.oracleId, dc.quantity - ch.quantity) : removeCard(deck, ch.oracleId);
        break;
      }
      case "swap":
        deck = swapCard(deck, ch.remove.oracleId, ch.add);
        break;
    }
  }
  // Keep the saved timestamp so "unchanged" comparisons stay stable.
  return deck === base ? base : { ...deck, updatedAt: base.updatedAt };
}

export function pushChange(state: SandboxState, change: SandboxChange): SandboxState {
  return { changes: [...state.changes, change], redo: [] };
}

export function undo(state: SandboxState): SandboxState {
  if (!state.changes.length) return state;
  const last = state.changes[state.changes.length - 1];
  return { changes: state.changes.slice(0, -1), redo: [last, ...state.redo] };
}

export function redo(state: SandboxState): SandboxState {
  if (!state.redo.length) return state;
  const [next, ...rest] = state.redo;
  return { changes: [...state.changes, next], redo: rest };
}

export function resetSandbox(): SandboxState {
  return EMPTY_SANDBOX;
}

/** Apply an entire upgrade package (a list of accepted swaps) as one change each. */
export function applySwaps(state: SandboxState, swaps: UpgradeSuggestion[], label = "Upgrade package"): SandboxState {
  let next = state;
  for (const s of swaps) next = pushChange(next, { kind: "swap", remove: s.remove, add: s.add, label });
  return next;
}

/** Human-readable label for one change. */
export function describeChange(ch: SandboxChange) {
  switch (ch.kind) {
    case "add":
      return `Add ${ch.quantity > 1 ? `${ch.quantity} ` : ""}${ch.card.name}`;
    case "remove":
      return `Remove ${ch.quantity > 1 ? `${ch.quantity} ` : ""}${ch.name}`;
    case "swap":
      return `${ch.remove.name} → ${ch.add.name}${ch.label ? ` (${ch.label})` : ""}`;
  }
}

/** Name → quantity map for the main deck plus commanders (for diffs). */
export function cardCounts(deck: Deck): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of deck.commanders) out.set(c.card.name, (out.get(c.card.name) ?? 0) + 1);
  for (const dc of deck.cards) {
    if ((dc.board ?? "main") !== "main") continue;
    out.set(dc.card.name, (out.get(dc.card.name) ?? 0) + dc.quantity);
  }
  return out;
}
