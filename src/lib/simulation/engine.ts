/**
 * Opening hand simulation. A seeded PRNG (mulberry32) keeps tests
 * deterministic and lets the UI re-deal the same hand. Results are sample
 * statistics, never guarantees, and the UI says so.
 */
import type { Card, Color, Deck } from "@/lib/types";
import { COLORS } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { hasLandBackFace, landColors } from "@/lib/analysis/mana";
import { classifyCard } from "@/lib/analysis/categories";
import { rulesText } from "@/lib/analysis/text";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** The library: main deck cards with quantities, commanders excluded. */
export function libraryOf(deck: Pick<Deck, "cards">): Card[] {
  const out: Card[] = [];
  for (const dc of deck.cards) {
    if ((dc.board ?? "main") !== "main") continue;
    for (let i = 0; i < dc.quantity; i++) out.push(dc.card);
  }
  return out;
}

export interface HandStats {
  lands: number;
  /** Lands plus MDFC land faces plus nonland mana producers castable with the hand's lands. */
  manaSources: number;
  ramp: number;
  cardDraw: number;
  interaction: number;
  averageManaValue: number;
  /** Colors the lands in hand can produce. */
  colors: Color[];
  /** Nonland cards whose colored pips the hand's lands can't cover. */
  uncastableByColor: number;
  castableByTurn3: number;
}

export interface GameState {
  seed: number;
  library: Card[];
  hand: Card[];
  mulligans: number;
  drawn: Card[];
}

export function newGame(deck: Pick<Deck, "cards" | "commanders">, seed: number, handSize = 7): GameState {
  const rand = mulberry32(seed);
  const library = shuffle(libraryOf(deck), rand);
  return { seed, library: library.slice(handSize), hand: library.slice(0, handSize), mulligans: 0, drawn: [] };
}

/** London mulligan: draw seven again, then the player would bottom N cards. We keep 7-N. */
export function mulligan(state: GameState, deck: Pick<Deck, "cards" | "commanders">): GameState {
  const next = newGame(deck, state.seed + 1000 * (state.mulligans + 1));
  const keep = Math.max(0, 7 - (state.mulligans + 1));
  return { ...next, hand: next.hand.slice(0, keep), library: [...next.hand.slice(keep), ...next.library], mulligans: state.mulligans + 1 };
}

export function drawCard(state: GameState): GameState {
  if (!state.library.length) return state;
  const [card, ...rest] = state.library;
  return { ...state, library: rest, hand: [...state.hand, card], drawn: [...state.drawn, card] };
}

const isRamp = (c: Card) => !isLand(c) && classifyCard(c).some((m) => m.category === "Ramp");
const isDraw = (c: Card) => !isLand(c) && classifyCard(c).some((m) => m.category === "Card Draw" || m.category === "Card Advantage");
const isInteraction = (c: Card) => !isLand(c) && classifyCard(c).some((m) => m.category === "Targeted Removal" || m.category === "Counterspells" || m.category === "Board Wipes");

export function handStats(hand: Card[], identity: Color[]): HandStats {
  const lands = hand.filter(isLand);
  const mdfc = hand.filter((c) => !isLand(c) && hasLandBackFace(c));
  const colors = new Set<Color>();
  for (const l of lands) for (const c of landColors(l, identity)) if (c !== "C") colors.add(c);
  for (const m of mdfc) for (const c of m.colorIdentity) colors.add(c);
  const nonland = hand.filter((c) => !isLand(c));
  const cheapProducers = nonland.filter((c) => c.cmc <= lands.length && /\{t\}[^:]*: add|add \{/.test(rulesText(c))).length;
  const uncastable = nonland.filter((c) => c.colors.some((col) => !colors.has(col))).length;
  const castable = nonland.filter((c) => c.cmc <= 3 && c.cmc <= Math.max(lands.length, 3) && c.colors.every((col) => colors.has(col))).length;
  return {
    lands: lands.length,
    manaSources: lands.length + mdfc.length + cheapProducers,
    ramp: hand.filter(isRamp).length,
    cardDraw: hand.filter(isDraw).length,
    interaction: hand.filter(isInteraction).length,
    averageManaValue: nonland.length ? Math.round((nonland.reduce((n, c) => n + c.cmc, 0) / nonland.length) * 100) / 100 : 0,
    colors: COLORS.filter((c) => colors.has(c)),
    uncastableByColor: uncastable,
    castableByTurn3: castable,
  };
}

export interface SimulationResult {
  hands: number;
  /** Index = number of lands (5 = five or more). */
  landDistribution: number[];
  withRamp: number;
  withDraw: number;
  withInteraction: number;
  /** Hands with 2–5 lands. */
  keepable: number;
  averageLands: number;
  averageManaValue: number;
  /** Hands where at least one card's colors aren't covered by the lands. */
  colorTrouble: number;
}

export function simulateHands(deck: Pick<Deck, "cards" | "commanders">, identity: Color[], count = 100, seed = 1): SimulationResult {
  const library = libraryOf(deck);
  const rand = mulberry32(seed);
  const landDistribution = [0, 0, 0, 0, 0, 0];
  let withRamp = 0;
  let withDraw = 0;
  let withInteraction = 0;
  let keepable = 0;
  let totalLands = 0;
  let totalMv = 0;
  let colorTrouble = 0;
  if (library.length < 7) return { hands: 0, landDistribution, withRamp, withDraw, withInteraction, keepable, averageLands: 0, averageManaValue: 0, colorTrouble };
  for (let i = 0; i < count; i++) {
    const hand = shuffle(library, rand).slice(0, 7);
    const s = handStats(hand, identity);
    landDistribution[Math.min(5, s.lands)]++;
    if (s.ramp) withRamp++;
    if (s.cardDraw) withDraw++;
    if (s.interaction) withInteraction++;
    if (s.lands >= 2 && s.lands <= 5) keepable++;
    if (s.uncastableByColor) colorTrouble++;
    totalLands += s.lands;
    totalMv += s.averageManaValue;
  }
  return {
    hands: count,
    landDistribution,
    withRamp,
    withDraw,
    withInteraction,
    keepable,
    averageLands: Math.round((totalLands / count) * 100) / 100,
    averageManaValue: Math.round((totalMv / count) * 100) / 100,
    colorTrouble,
  };
}

/**
 * Exact hypergeometric probability of drawing exactly k lands in a 7-card
 * hand, as a reference next to the sampled distribution.
 */
export function landProbability(deckSize: number, lands: number, k: number, handSize = 7): number {
  const choose = (n: number, r: number) => {
    if (r < 0 || r > n) return 0;
    let out = 1;
    for (let i = 1; i <= r; i++) out = (out * (n - r + i)) / i;
    return out;
  };
  return (choose(lands, k) * choose(deckSize - lands, handSize - k)) / choose(deckSize, handSize);
}
