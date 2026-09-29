/**
 * Core domain models for Commander Workshop.
 *
 * These are deliberately decoupled from Scryfall's raw response shape
 * (see `lib/scryfall/types.ts`) so the storage layer and UI never depend on
 * a third-party schema. `normalizeCard` is the only bridge between the two.
 */

export type Color = "W" | "U" | "B" | "R" | "G";
export const COLORS: Color[] = ["W", "U", "B", "R", "G"];
export type ManaColor = Color | "C";

export type Legality = "legal" | "not_legal" | "banned" | "restricted";

export type CardType =
  | "Creature"
  | "Artifact"
  | "Enchantment"
  | "Instant"
  | "Sorcery"
  | "Planeswalker"
  | "Battle"
  | "Land";

/** Deck sections, in display order. */
export type DeckSection = CardType | "Commander" | "Other";
export const DECK_SECTIONS: DeckSection[] = [
  "Commander",
  "Creature",
  "Planeswalker",
  "Battle",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Land",
  "Other",
];

export interface CardFace {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  imageNormal?: string;
}

export interface CardPrices {
  usd?: number;
  usdFoil?: number;
  eur?: number;
  tix?: number;
}

export interface CardImages {
  small?: string;
  normal?: string;
  large?: string;
  artCrop?: string;
}

/** A normalized Magic card (one printing). */
export interface Card {
  id: string;
  oracleId: string;
  name: string;
  manaCost: string;
  cmc: number;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors: Color[];
  colorIdentity: Color[];
  keywords: string[];
  producedMana: ManaColor[];
  commanderLegality: Legality;
  set: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  prices: CardPrices;
  images: CardImages;
  faces?: CardFace[];
  scryfallUri: string;
  layout: string;
  /** Epoch ms when this data was fetched. */
  fetchedAt: number;
}

export type Board = "main" | "maybe";

/** A card entry in a deck. */
export interface DeckCard {
  card: Card;
  quantity: number;
  /** Never suggest removing this card in upgrades. */
  locked?: boolean;
  board?: Board;
  /** Manual corrections to functional categories. */
  categoryOverrides?: { add: FunctionalCategory[]; remove: FunctionalCategory[] };
}

/** A commander slot. Partners/backgrounds are additional entries. */
export interface Commander {
  card: Card;
  locked?: boolean;
}

/** A decklist line that could not be resolved against Scryfall. */
export interface UnresolvedCard {
  line: string;
  name: string;
  quantity: number;
  reason: string;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  commanders: Commander[];
  cards: DeckCard[];
  unresolved: UnresolvedCard[];
  createdAt: number;
  updatedAt: number;
}

export type FunctionalCategory =
  | "Ramp"
  | "Card Draw"
  | "Targeted Removal"
  | "Board Wipes"
  | "Protection"
  | "Counterspells"
  | "Graveyard Recursion"
  | "Tutors"
  | "Token Generation"
  | "Lifegain"
  | "Sacrifice Outlets"
  | "Finishers";

export const FUNCTIONAL_CATEGORIES: FunctionalCategory[] = [
  "Ramp",
  "Card Draw",
  "Targeted Removal",
  "Board Wipes",
  "Protection",
  "Counterspells",
  "Graveyard Recursion",
  "Tutors",
  "Token Generation",
  "Lifegain",
  "Sacrifice Outlets",
  "Finishers",
];

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  cards?: string[];
}

export interface HealthDiagnostic {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  cards?: string[];
}

export interface CategorizedCard {
  name: string;
  categories: FunctionalCategory[];
  /** Categories set by the user rather than heuristics. */
  manual: FunctionalCategory[];
}

export interface ThemeCardRole {
  name: string;
  role: "enabler" | "payoff" | "both";
}

export interface SynergyInteraction {
  ruleId: string;
  title: string;
  explanation: string;
  sources: string[];
  targets: string[];
}

export interface DeckTheme {
  id: string;
  name: string;
  description: string;
  /** 0–100 relative strength. */
  score: number;
  cards: ThemeCardRole[];
  interactions: SynergyInteraction[];
}

export interface ManaProduction {
  /** Sources that can produce each color (lands + nonland producers). */
  sources: Record<ManaColor, number>;
  landSources: Record<ManaColor, number>;
  /** Colored pips required by nonland spells. */
  pips: Record<Color, number>;
  /** Share of pips per color minus share of sources per color. */
  mismatches: { color: Color; pipShare: number; sourceShare: number }[];
}

export interface DeckAnalysis {
  totalCards: number;
  landCount: number;
  nonlandCount: number;
  averageManaValue: number;
  /** Nonland mana curve buckets 0..7 (7 = 7+). */
  manaCurve: { mv: string; count: number; creatures: number; other: number }[];
  typeCounts: Record<CardType, number>;
  colorCounts: Record<Color | "Colorless" | "Multicolor", number>;
  manaProduction: ManaProduction;
  categories: Record<FunctionalCategory, string[]>;
  cardCategories: Record<string, CategorizedCard>;
  totalPrice: number;
  pricedCards: number;
  validation: ValidationIssue[];
  health: HealthDiagnostic[];
  themes: DeckTheme[];
}

export type Strategy = "Casual" | "Focused" | "Optimized" | "High Power";
export const STRATEGIES: Strategy[] = ["Casual", "Focused", "Optimized", "High Power"];

export type UpgradeGoal =
  | "More Ramp"
  | "More Card Draw"
  | "More Interaction"
  | "Better Mana Base"
  | "Lower Mana Curve"
  | "More Synergy"
  | "Improve Win Conditions";
export const UPGRADE_GOALS: UpgradeGoal[] = [
  "More Ramp",
  "More Card Draw",
  "More Interaction",
  "Better Mana Base",
  "Lower Mana Curve",
  "More Synergy",
  "Improve Win Conditions",
];

export interface DeckRecommendation {
  card: Card;
  score: number;
  reasons: string[];
  categories: FunctionalCategory[];
  themes: string[];
}

export interface UpgradeSuggestion {
  id: string;
  remove: Card;
  add: Card;
  priceDelta: number;
  manaValueDelta: number;
  removedCategories: FunctionalCategory[];
  addedCategories: FunctionalCategory[];
  explanation: string;
  removeReason: string;
  score: number;
}

export interface UpgradeOptions {
  budget: number;
  strategy: Strategy;
  goals: UpgradeGoal[];
  maxSwaps: number;
}

export interface Preferences {
  defaultBudget: number;
  defaultStrategy: Strategy;
  cardView: "list" | "visual";
  priceCurrency: "usd" | "eur" | "tix";
  activeDeckId?: string;
  showPrices: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  defaultBudget: 25,
  defaultStrategy: "Focused",
  cardView: "list",
  priceCurrency: "usd",
  showPrices: true,
};
