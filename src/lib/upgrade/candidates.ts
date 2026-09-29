/**
 * Candidate discovery: builds targeted Scryfall queries from the deck's
 * weaknesses, goals and themes, restricted to the commander's color identity,
 * Commander legality and the budget. Scoring happens separately.
 */
import type { Card, Color } from "@/lib/types";
import { searchCards } from "@/lib/scryfall";
import type { ScoringContext } from "./context";

export interface CandidateQuery {
  id: string;
  label: string;
  query: string;
}

const THEME_QUERIES: Record<string, string> = {
  food: "o:food",
  treasure: "o:treasure",
  clues: "(o:clue or o:investigate)",
  artifacts: '(o:"artifact you control enters" or o:"artifacts you control" or o:"for each artifact" or o:"artifact token")',
  tokens: '(o:"creature token" or o:"creatures you control get")',
  counters: 'o:"+1/+1 counter"',
  lifegain: '(o:"gain life" or o:"you gain" or keyword:lifelink)',
  aristocrats: '(o:"creature you control dies" or o:"another creature dies" or o:"a creature dies")',
  sacrifice: '(o:"sacrifice a" o:":")',
  graveyard: '(o:"from your graveyard" or o:mill)',
  spellslinger: 'o:"instant or sorcery"',
  equipment: "(t:equipment or o:equipped)",
  enchantments: '(o:"enchantment spell" or o:constellation or o:"enchantment you control")',
  landfall: '(o:landfall or o:"land you control enters")',
};

export function buildCandidateQueries(ctx: ScoringContext): CandidateQuery[] {
  const { identity, analysis, options, perCardCap } = ctx;
  const base = `f:commander game:paper ${identityFilter(identity)} usd<=${perCardCap.toFixed(2)}`;
  const nonland = "-t:land";
  const queries: CandidateQuery[] = [];
  const add = (id: string, label: string, q: string) => queries.push({ id, label, query: `${base} ${q}` });

  const goals = new Set(options.goals);
  const cats = analysis.categories;

  if (goals.has("More Ramp") || cats.Ramp.length < 9) {
    add("ramp", "Ramp", `${nonland} mv<=3 (o:"add {" or (o:"search your library" o:"land" o:"onto the battlefield") or o:"create a treasure")`);
  }
  if (goals.has("More Card Draw") || cats["Card Draw"].length < 9) {
    add("draw", "Card Draw", `${nonland} (o:"draw a card" or o:"draw two" or o:"draws a card" or o:investigate or o:"draw cards")`);
  }
  if (goals.has("More Interaction") || cats["Targeted Removal"].length + cats.Counterspells.length < 8) {
    add("removal", "Interaction", `${nonland} (o:"destroy target" or o:"exile target" or o:"counter target")`);
  }
  if (goals.has("More Interaction") || cats["Board Wipes"].length < 1) {
    add("wipes", "Board Wipes", `${nonland} (o:"destroy all" or o:"exile all" or o:"all creatures get -")`);
  }
  if (goals.has("Improve Win Conditions")) {
    add("finishers", "Win Conditions", `${nonland} (o:"each opponent loses" or o:"additional combat" or o:"creatures you control get +" or o:"loses that much life")`);
  }
  if (goals.has("Better Mana Base") && identity.length > 1) {
    add("lands", "Mana Base", "t:land -t:basic -id:c");
  }
  if (goals.has("Lower Mana Curve")) {
    add("cheap", "Cheap Spells", `${nonland} mv<=2`);
  }

  // Always search for the strongest themes; with "More Synergy", go deeper.
  const themeCount = goals.has("More Synergy") ? 4 : 2;
  for (const theme of analysis.themes.slice(0, themeCount)) {
    const q = theme.id.startsWith("typal-")
      ? `(t:${theme.id.slice(6)} or o:${theme.id.slice(6)})`
      : THEME_QUERIES[theme.id];
    if (q) add(`theme-${theme.id}`, theme.name, `${goals.has("Better Mana Base") ? "" : nonland} ${q}`.trim());
  }
  return queries;
}

function identityFilter(identity: Color[]) {
  return identity.length ? `id<=${identity.join("").toLowerCase()}` : "id:c";
}

export interface CandidatePool {
  cards: Card[];
  /** Popularity rank within the query that found it (0 = most popular). */
  rank: Map<string, number>;
  sources: Map<string, string[]>;
  errors: string[];
}

/** Run candidate queries (sequentially through the rate-limited client). */
export async function fetchCandidates(
  queries: CandidateQuery[],
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<CandidatePool> {
  const byId = new Map<string, Card>();
  const rank = new Map<string, number>();
  const sources = new Map<string, string[]>();
  const errors: string[] = [];
  for (const [i, q] of queries.entries()) {
    try {
      const res = await searchCards(q.query, { order: "edhrec", signal: opts.signal });
      res.cards.forEach((card, idx) => {
        if (!byId.has(card.oracleId)) byId.set(card.oracleId, card);
        rank.set(card.oracleId, Math.min(rank.get(card.oracleId) ?? Infinity, idx / Math.max(1, res.cards.length)));
        sources.set(card.oracleId, [...(sources.get(card.oracleId) ?? []), q.label]);
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      errors.push(`${q.label}: ${(err as Error).message}`);
    }
    opts.onProgress?.(i + 1, queries.length);
  }
  return { cards: [...byId.values()], rank, sources, errors };
}

