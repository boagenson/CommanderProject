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
/** Manual corrections layered over automatic classification. */
export interface Overrides<T extends string> {
  add: T[];
  remove: T[];
}

/**
 * How strongly the user wants to keep a card.
 * - locked: never suggested as a cut.
 * - favorite: only cut under "Maximum Optimization".
 * - flavor: thematic relevance weighs heavily; cut only when asked to optimize aggressively.
 */
export type ProtectionLevel = "locked" | "favorite" | "flavor";
export const PROTECTION_LEVELS: ProtectionLevel[] = ["locked", "favorite", "flavor"];

export interface DeckCard {
  card: Card;
  quantity: number;
  /** Never suggest removing this card in upgrades. */
  locked?: boolean;
  /** Avoid cutting unless the user asks for aggressive optimization. */
  favorite?: boolean;
  /** Thematic relevance is highly important for this card. */
  flavorEssential?: boolean;
  board?: Board;
  /** Manual corrections to functional roles. */
  categoryOverrides?: Overrides<FunctionalCategory>;
  /** Manual corrections to thematic tags. */
  tagOverrides?: Overrides<ThematicTag>;
}

/** A commander slot. Partners/backgrounds are additional entries. */
export interface Commander {
  card: Card;
  locked?: boolean;
  /** Manual corrections to functional roles. */
  categoryOverrides?: Overrides<FunctionalCategory>;
  tagOverrides?: Overrides<ThematicTag>;
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
  /** What the player wants this deck to do. Optional for decks saved before Phase 2. */
  intent?: DeckIntent;
  /** Saved snapshots, oldest first. */
  versions?: DeckVersion[];
  /** Recorded games, newest first. */
  playtests?: PlaytestEntry[];
  /** User corrections to detected win conditions. */
  winConditionOverrides?: Overrides<WinConditionType>;
}

/**
 * Functional roles a card can play. A card may hold several. The first
 * twelve are the Phase 1 categories; the rest were added for Deck Doctor.
 */
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
  | "Finishers"
  | "Card Advantage"
  | "Mana Fixing"
  | "Drain"
  | "Cost Reduction"
  | "Payoff"
  | "Enabler"
  | "Combo Piece";

export const FUNCTIONAL_CATEGORIES: FunctionalCategory[] = [
  "Ramp",
  "Mana Fixing",
  "Card Draw",
  "Card Advantage",
  "Targeted Removal",
  "Board Wipes",
  "Counterspells",
  "Protection",
  "Graveyard Recursion",
  "Tutors",
  "Token Generation",
  "Sacrifice Outlets",
  "Lifegain",
  "Drain",
  "Cost Reduction",
  "Enabler",
  "Payoff",
  "Finishers",
  "Combo Piece",
];

/** Alias used by Phase 2 code; the same union as FunctionalCategory. */
export type CardRole = FunctionalCategory;

/** Mechanical themes a card touches, independent of its functional role. */
export type ThematicTag =
  | "Food"
  | "Treasure"
  | "Clue"
  | "Artifact"
  | "Token"
  | "Lifegain"
  | "Sacrifice"
  | "Death Trigger"
  | "ETB"
  | "Counters"
  | "Graveyard"
  | "Equipment"
  | "Landfall"
  | "Enchantment"
  | "Spells"
  | "Combat"
  | "Legendary";

export const THEMATIC_TAGS: ThematicTag[] = [
  "Food",
  "Treasure",
  "Clue",
  "Artifact",
  "Token",
  "Lifegain",
  "Sacrifice",
  "Death Trigger",
  "ETB",
  "Counters",
  "Graveyard",
  "Equipment",
  "Landfall",
  "Enchantment",
  "Spells",
  "Combat",
  "Legendary",
];

/** An automatically assigned role or tag with how sure the heuristics are (0–1). */
export interface Classification<T extends string> {
  value: T;
  confidence: number;
  reason: string;
  /** True when set by the user rather than detected. */
  manual?: boolean;
}

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
  /** Full role classifications with confidence, after overrides. */
  roles: Classification<FunctionalCategory>[];
  /** Thematic tags after overrides. */
  tags: Classification<ThematicTag>[];
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
  /** Phase 2 sections. */
  mana: ManaReport;
  /** Present combos plus near-combos (missing one card). */
  combos: DetectedCombo[];
  winConditions: WinConditionReport;
  graph: SynergyGraph;
  packages: SynergyPackage[];
}

// ---------------------------------------------------------------------------
// Phase 2: Deck Intent
// ---------------------------------------------------------------------------

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

/** Named strategies a player can choose or the app can detect. */
export type StrategyName =
  | "Food"
  | "Tokens"
  | "Aristocrats"
  | "Lifegain"
  | "Voltron"
  | "Spellslinger"
  | "Reanimator"
  | "Artifacts"
  | "Enchantress"
  | "Landfall"
  | "Control"
  | "Combo"
  | "Creature Typal"
  | "Counters"
  | "Blink"
  | "Sacrifice"
  | "Graveyard"
  | "Treasure"
  | "Equipment"
  | "Group Hug"
  | "Stax";

export const STRATEGY_NAMES: StrategyName[] = [
  "Food",
  "Tokens",
  "Aristocrats",
  "Lifegain",
  "Voltron",
  "Spellslinger",
  "Reanimator",
  "Artifacts",
  "Enchantress",
  "Landfall",
  "Control",
  "Combo",
  "Creature Typal",
  "Counters",
  "Blink",
  "Sacrifice",
  "Graveyard",
  "Treasure",
  "Equipment",
  "Group Hug",
  "Stax",
];

export type PlayerPriority =
  | "Flavor"
  | "Theme"
  | "Budget"
  | "Consistency"
  | "Synergy"
  | "Speed"
  | "Resilience"
  | "Interaction"
  | "Explosive Turns"
  | "Casual Table Experience";

export const PLAYER_PRIORITIES: PlayerPriority[] = [
  "Flavor",
  "Theme",
  "Budget",
  "Consistency",
  "Synergy",
  "Speed",
  "Resilience",
  "Interaction",
  "Explosive Turns",
  "Casual Table Experience",
];

export type UpgradePhilosophy = "Preserve Theme" | "Balanced" | "Maximum Optimization";
export const UPGRADE_PHILOSOPHIES: UpgradePhilosophy[] = ["Preserve Theme", "Balanced", "Maximum Optimization"];

/** What the player wants the deck to accomplish. Stored on the deck. */
export interface DeckIntent {
  power: Strategy;
  /** Undefined means "use the detected strategy". */
  primaryStrategy?: StrategyName;
  secondaryStrategies: StrategyName[];
  priorities: PlayerPriority[];
  philosophy: UpgradePhilosophy;
  /** Free-text description of what the player wants, in their own words. */
  goals: string;
  /** Strategies explicitly rejected by the user, so detection stops suggesting them. */
  dismissedStrategies?: StrategyName[];
}

export const DEFAULT_INTENT: DeckIntent = {
  power: "Focused",
  secondaryStrategies: [],
  priorities: [],
  philosophy: "Balanced",
  goals: "",
};

// ---------------------------------------------------------------------------
// Phase 2: Win conditions, combos, synergy graph, packages
// ---------------------------------------------------------------------------

export type WinConditionType =
  | "Combat damage"
  | "Commander damage"
  | "Token swarm"
  | "Life drain"
  | "Aristocrats"
  | "Infinite combo"
  | "Large creatures"
  | "Alternate win condition"
  | "Value engine";

export const WIN_CONDITION_TYPES: WinConditionType[] = [
  "Combat damage",
  "Commander damage",
  "Token swarm",
  "Life drain",
  "Aristocrats",
  "Infinite combo",
  "Large creatures",
  "Alternate win condition",
  "Value engine",
];

export interface WinCondition {
  type: WinConditionType;
  /** 0–100 how well supported this plan looks. */
  strength: number;
  cards: string[];
  explanation: string;
  manual?: boolean;
}

export interface WinConditionReport {
  conditions: WinCondition[];
  /** True when no plan cleared the confidence bar. */
  unclear: boolean;
  note: string;
}

export type ComboType = "infinite" | "engine" | "synergy" | "near";

export interface ComboDefinition {
  id: string;
  name: string;
  /** Card names that must all be present. */
  required: string[];
  /** Card names that make it better or complete a variant. */
  optional?: string[];
  result: string;
  requirements?: string[];
  description: string;
  type: Exclude<ComboType, "near">;
  /** Where the definition came from (built-in, or an external source id). */
  source?: string;
}

export interface DetectedCombo {
  definition: ComboDefinition;
  type: ComboType;
  present: string[];
  missing: string[];
  optionalPresent: string[];
}

export type SynergyEdgeKind = "strong" | "theme" | "combo" | "enabler-payoff" | "token" | "sacrifice";
export const SYNERGY_EDGE_KINDS: SynergyEdgeKind[] = ["strong", "theme", "combo", "enabler-payoff", "token", "sacrifice"];

export interface SynergyNode {
  id: string;
  name: string;
  isCommander: boolean;
  themes: string[];
  roles: FunctionalCategory[];
  /** Sum of incident edge weights. */
  degree: number;
}

export interface SynergyEdge {
  source: string;
  target: string;
  kind: SynergyEdgeKind;
  weight: number;
  label: string;
}

export interface SynergyGraph {
  nodes: SynergyNode[];
  edges: SynergyEdge[];
}

export interface SynergyPackage {
  id: string;
  name: string;
  /** 0–100 how complete and strong this package is. */
  strength: number;
  purpose: string;
  enablers: string[];
  payoffs: string[];
  support: string[];
  themes: string[];
}

// ---------------------------------------------------------------------------
// Phase 2: Mana Base Doctor
// ---------------------------------------------------------------------------

export interface ManaSourceBreakdown {
  lands: number;
  untappedLands: number;
  tappedLands: number;
  /** Lands whose entry condition depends on other lands (checklands, shocks). */
  conditionalLands: number;
  manaRocks: number;
  manaDorks: number;
  landRamp: number;
  treasureMakers: number;
  costReducers: number;
  /** Nonland cards that produce two or more of the deck's colors. */
  fixers: number;
  /** MDFC / modal cards with a land face. */
  mdfcLands: number;
}

export interface ColorDemand {
  color: Color;
  /** Weighted pips (hybrid counts half). */
  pips: number;
  /** Cards with at least one pip of this color. */
  cards: number;
  /** Cards needing two or more pips of this color. */
  heavyCards: number;
  /** Share of colored pips (0–1). */
  pipShare: number;
  /** Share of colored sources (0–1). */
  sourceShare: number;
  sources: number;
  landSources: number;
  untappedLandSources: number;
  /** Pip share minus source share; positive means under-supplied. */
  gap: number;
}

export interface ManaReport {
  landCount: number;
  /** Suggested land range for this curve and ramp count. */
  suggestedLands: { low: number; high: number };
  /** Colored + colorless requirement counts. */
  colorlessPips: number;
  genericPips: number;
  demand: ColorDemand[];
  breakdown: ManaSourceBreakdown;
  /** Total nonland mana producers (rocks, dorks, ramp spells, treasure). */
  rampCount: number;
  /** Phrased as potential concerns, never verdicts. */
  concerns: HealthDiagnostic[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Phase 2: Deck Doctor report
// ---------------------------------------------------------------------------

export interface DoctorFinding {
  id: string;
  title: string;
  detail: string;
  /** Cards that support the finding. */
  cards?: string[];
  severity?: Severity;
}

export interface DetectedStrategy {
  name: StrategyName;
  /** 0–100. */
  score: number;
  /** Theme ids that produced this detection. */
  themes: string[];
  explanation: string;
}

export interface DeckDoctorReport {
  commanderStrategy: string;
  archetypes: DetectedStrategy[];
  primary: DetectedStrategy | null;
  secondary: DetectedStrategy[];
  gamePlan: string;
  strengths: DoctorFinding[];
  weaknesses: DoctorFinding[];
  manaConcerns: DoctorFinding[];
  roleCoverage: { role: FunctionalCategory; count: number; target: number; cards: string[]; note: string }[];
  winConditions: WinConditionReport;
  packages: SynergyPackage[];
  combos: DetectedCombo[];
  /** Cards that appear less connected to the primary themes. */
  disconnected: { name: string; connection: number; note: string }[];
  /** Whether the user's intent disagrees with what was detected. */
  intentNotes: string[];
}

// ---------------------------------------------------------------------------
// Phase 2: Versions, playtests
// ---------------------------------------------------------------------------

/** Compact stats stored with a version so the change log renders without re-analysis. */
export interface DeckSnapshotStats {
  cards: number;
  lands: number;
  averageManaValue: number;
  ramp: number;
  cardDraw: number;
  removal: number;
  totalPrice: number;
  themes: { id: string; name: string; score: number }[];
}

export interface DeckVersion {
  id: string;
  number: number;
  name: string;
  createdAt: number;
  notes: string;
  /** Names with quantities, e.g. "2 Plains". */
  cards: { name: string; oracleId: string; quantity: number }[];
  commanders: string[];
  added: string[];
  removed: string[];
  stats: DeckSnapshotStats;
}

export type PlaytestResult = "Win" | "Loss" | "Draw" | "Unfinished";
export const PLAYTEST_RESULTS: PlaytestResult[] = ["Win", "Loss", "Draw", "Unfinished"];

export type PlaytestTag =
  | "Mana Screwed"
  | "Mana Flooded"
  | "Great Opening Hand"
  | "Needed More Draw"
  | "Needed More Removal"
  | "Strong Synergy"
  | "Couldn't Finish Game"
  | "Commander Removed Repeatedly"
  | "Won Through Combat"
  | "Won Through Drain";

export const PLAYTEST_TAGS: PlaytestTag[] = [
  "Mana Screwed",
  "Mana Flooded",
  "Great Opening Hand",
  "Needed More Draw",
  "Needed More Removal",
  "Strong Synergy",
  "Couldn't Finish Game",
  "Commander Removed Repeatedly",
  "Won Through Combat",
  "Won Through Drain",
];

export interface PlaytestEntry {
  id: string;
  date: number;
  players?: number;
  result?: PlaytestResult;
  /** Approximate length in turns. */
  turns?: number;
  openingHand?: string;
  manaIssues?: string;
  performedWell: string[];
  underperformed: string[];
  stuckInHand: string[];
  strategyNotes?: string;
  notes?: string;
  tags: PlaytestTag[];
}

export interface PlaytestInsight {
  id: string;
  title: string;
  detail: string;
  /** Games that support the observation, out of the total considered. */
  support: number;
  total: number;
  cards?: string[];
  severity: Severity;
}

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
  /** Protection level of the removed card, when it was a favorite the user allowed cutting. */
  removeProtection?: ProtectionLevel;
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
  /** Deck intent that shapes scoring; defaults to the deck's saved intent. */
  intent?: DeckIntent;
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
