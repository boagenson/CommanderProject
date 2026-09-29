/**
 * Immutable deck operations. Every function returns a new Deck with
 * `updatedAt` bumped; callers persist through the storage layer.
 */
import type { Card, Deck, DeckCard, DeckIntent, FunctionalCategory, PlaytestEntry, ProtectionLevel, ThematicTag, UnresolvedCard, WinConditionType } from "@/lib/types";
import type { ResolvedEntry } from "./resolve";

const touch = (deck: Deck, patch: Partial<Deck>): Deck => ({ ...deck, ...patch, updatedAt: Date.now() });

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDeck(name: string, commanders: Card[] = []): Deck {
  const now = Date.now();
  return {
    id: newId(),
    name: name.trim() || "Untitled Deck",
    commanders: commanders.map((card) => ({ card })),
    cards: [],
    unresolved: [],
    createdAt: now,
    updatedAt: now,
  };
}

const sameCard = (a: Card, b: Card) => a.oracleId === b.oracleId;

export function addCard(deck: Deck, card: Card, quantity = 1, board: "main" | "maybe" = "main"): Deck {
  const idx = deck.cards.findIndex((dc) => sameCard(dc.card, card) && (dc.board ?? "main") === board);
  if (idx >= 0) {
    const cards = deck.cards.slice();
    cards[idx] = { ...cards[idx], quantity: cards[idx].quantity + quantity };
    return touch(deck, { cards });
  }
  return touch(deck, { cards: [...deck.cards, { card, quantity, board }] });
}

export function removeCard(deck: Deck, oracleId: string, board: "main" | "maybe" = "main"): Deck {
  return touch(deck, {
    cards: deck.cards.filter((dc) => !(dc.card.oracleId === oracleId && (dc.board ?? "main") === board)),
  });
}

export function setQuantity(deck: Deck, oracleId: string, quantity: number): Deck {
  if (quantity <= 0) return removeCard(deck, oracleId);
  return touch(deck, {
    cards: deck.cards.map((dc) => (dc.card.oracleId === oracleId && (dc.board ?? "main") === "main" ? { ...dc, quantity } : dc)),
  });
}

export function updateCard(deck: Deck, oracleId: string, patch: Partial<DeckCard>): Deck {
  return touch(deck, {
    cards: deck.cards.map((dc) => (dc.card.oracleId === oracleId ? { ...dc, ...patch } : dc)),
  });
}

export function toggleLock(deck: Deck, oracleId: string): Deck {
  const isCommander = deck.commanders.some((c) => c.card.oracleId === oracleId);
  if (isCommander) return deck; // Commanders are never swap candidates.
  const dc = deck.cards.find((d) => d.card.oracleId === oracleId);
  return updateCard(deck, oracleId, { locked: !dc?.locked });
}

/** Toggle a protection level. Levels are independent flags; locked implies never cut. */
export function setProtection(deck: Deck, oracleId: string, level: ProtectionLevel, on: boolean): Deck {
  if (deck.commanders.some((c) => c.card.oracleId === oracleId)) return deck;
  const key = level === "locked" ? "locked" : level === "favorite" ? "favorite" : "flavorEssential";
  return updateCard(deck, oracleId, { [key]: on || undefined });
}

function toggleOverride<T extends string>(current: { add: T[]; remove: T[] } | undefined, value: T, state: "auto" | "on" | "off") {
  const add = new Set(current?.add ?? []);
  const remove = new Set(current?.remove ?? []);
  add.delete(value);
  remove.delete(value);
  if (state === "on") add.add(value);
  if (state === "off") remove.add(value);
  return { add: [...add], remove: [...remove] };
}

export function setTagOverride(deck: Deck, oracleId: string, tag: ThematicTag, state: "auto" | "on" | "off"): Deck {
  const commander = deck.commanders.find((c) => c.card.oracleId === oracleId);
  const dc = commander ?? deck.cards.find((d) => d.card.oracleId === oracleId);
  if (!dc) return deck;
  const tagOverrides = toggleOverride(dc.tagOverrides, tag, state);
  if (commander) {
    return touch(deck, { commanders: deck.commanders.map((c) => (c.card.oracleId === oracleId ? { ...c, tagOverrides } : c)) });
  }
  return updateCard(deck, oracleId, { tagOverrides });
}

export function setIntent(deck: Deck, intent: DeckIntent): Deck {
  return touch(deck, { intent });
}

export function setWinConditionOverride(deck: Deck, type: WinConditionType, state: "auto" | "on" | "off"): Deck {
  return touch(deck, { winConditionOverrides: toggleOverride(deck.winConditionOverrides, type, state) });
}

export function addPlaytest(deck: Deck, entry: PlaytestEntry): Deck {
  return touch(deck, { playtests: [entry, ...(deck.playtests ?? []).filter((p) => p.id !== entry.id)].sort((a, b) => b.date - a.date) });
}

export function removePlaytest(deck: Deck, id: string): Deck {
  return touch(deck, { playtests: (deck.playtests ?? []).filter((p) => p.id !== id) });
}

/** Copy a deck (cards, intent, protections) under a new id and name. Versions and playtests start fresh. */
export function duplicateDeck(deck: Deck, name: string): Deck {
  const now = Date.now();
  return { ...deck, id: newId(), name: name.trim() || `${deck.name} (copy)`, versions: [], playtests: [], createdAt: now, updatedAt: now };
}

export function setCategoryOverride(
  deck: Deck,
  oracleId: string,
  category: FunctionalCategory,
  state: "auto" | "on" | "off",
): Deck {
  const commander = deck.commanders.find((c) => c.card.oracleId === oracleId);
  const dc = commander ?? deck.cards.find((d) => d.card.oracleId === oracleId);
  if (!dc) return deck;
  const add = new Set(dc.categoryOverrides?.add ?? []);
  const remove = new Set(dc.categoryOverrides?.remove ?? []);
  add.delete(category);
  remove.delete(category);
  if (state === "on") add.add(category);
  if (state === "off") remove.add(category);
  const categoryOverrides = { add: [...add], remove: [...remove] };
  if (commander) {
    return touch(deck, {
      commanders: deck.commanders.map((c) => (c.card.oracleId === oracleId ? { ...c, categoryOverrides } : c)),
    });
  }
  return updateCard(deck, oracleId, { categoryOverrides });
}

/** Set commanders; any of those cards in the main deck move to the command zone. */
export function setCommanders(deck: Deck, commanders: Card[]): Deck {
  const ids = new Set(commanders.map((c) => c.oracleId));
  const cards = deck.cards
    .map((dc) => (ids.has(dc.card.oracleId) && (dc.board ?? "main") === "main" ? { ...dc, quantity: dc.quantity - 1 } : dc))
    .filter((dc) => dc.quantity > 0);
  // Former commanders go back into the main deck so nothing silently disappears.
  const demoted = deck.commanders.filter((c) => !ids.has(c.card.oracleId));
  const kept = new Map(deck.commanders.map((c) => [c.card.oracleId, c]));
  let next = touch(deck, { commanders: commanders.map((card) => ({ ...kept.get(card.oracleId), card })), cards });
  for (const d of demoted) next = addCard(next, d.card);
  return next;
}

/** Merge resolved import entries into a deck. */
export function importEntries(
  deck: Deck,
  resolved: ResolvedEntry[],
  unresolved: UnresolvedCard[],
  opts: { replace?: boolean } = {},
): Deck {
  let next: Deck = opts.replace ? touch(deck, { cards: [], unresolved: [] }) : deck;
  const commanderCards = resolved.filter((r) => r.entry.section === "commander").map((r) => r.card);
  if (commanderCards.length) {
    const existing = opts.replace ? [] : next.commanders.map((c) => c.card);
    const merged = [...existing];
    for (const c of commanderCards) if (!merged.some((m) => m.oracleId === c.oracleId)) merged.push(c);
    next = touch(next, { commanders: merged.map((card) => ({ card })) });
  }
  const commanderIds = new Set(next.commanders.map((c) => c.card.oracleId));
  for (const { entry, card } of resolved) {
    if (entry.section === "commander") continue;
    // A commander also listed in the 99 is almost always an export artifact.
    if (entry.section === "main" && commanderIds.has(card.oracleId)) continue;
    next = addCard(next, card, entry.quantity, entry.section === "maybe" ? "maybe" : "main");
  }
  return touch(next, { unresolved: [...(opts.replace ? [] : next.unresolved), ...unresolved] });
}

/** Replace `removeId` with `add` (used by upgrade swaps). */
export function swapCard(deck: Deck, removeOracleId: string, add: Card): Deck {
  const dc = deck.cards.find((d) => d.card.oracleId === removeOracleId && (d.board ?? "main") === "main");
  let next = deck;
  if (dc) next = dc.quantity > 1 ? setQuantity(next, removeOracleId, dc.quantity - 1) : removeCard(next, removeOracleId);
  return addCard(next, add);
}

export function dismissUnresolved(deck: Deck, index?: number): Deck {
  return touch(deck, { unresolved: index == null ? [] : deck.unresolved.filter((_, i) => i !== index) });
}

/** Plain-text export compatible with the importer. */
export function exportDecklist(deck: Deck): string {
  const lines: string[] = [];
  if (deck.commanders.length) {
    lines.push("Commander");
    for (const c of deck.commanders) lines.push(`1 ${c.card.name}`);
    lines.push("", "Deck");
  }
  for (const dc of deck.cards.filter((d) => (d.board ?? "main") === "main")) lines.push(`${dc.quantity} ${dc.card.name}`);
  const maybe = deck.cards.filter((d) => d.board === "maybe");
  if (maybe.length) {
    lines.push("", "Maybeboard");
    for (const dc of maybe) lines.push(`${dc.quantity} ${dc.card.name}`);
  }
  return lines.join("\n");
}
