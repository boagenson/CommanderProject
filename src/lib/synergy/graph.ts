/**
 * Synergy graph: cards as nodes, meaningful mechanical relationships as
 * edges. Edges come from three places only, so two cards never connect just
 * for sharing a color or type:
 *   1. Interaction rules (`interactions.ts`) — source × target pairs.
 *   2. Theme roles — an enabler of a theme connects to that theme's payoffs.
 *   3. Known combos (`combo/engine.ts`).
 * When a graph gets noisy, each node keeps only its strongest `MAX_PER_NODE`
 * edges (combo and strong edges are always kept).
 */
import type { Card, DetectedCombo, DeckTheme, FunctionalCategory, SynergyEdge, SynergyEdgeKind, SynergyGraph, SynergyNode } from "@/lib/types";
import { isLand } from "@/lib/cards/helpers";
import { rulesText } from "@/lib/analysis/text";
import { INTERACTION_RULES } from "./interactions";
import { THEME_BY_ID, THEMES } from "./themes";

export const MAX_PER_NODE = 6;
export const MAX_EDGES = 260;

const TOKEN_THEMES = new Set(["food", "treasure", "clues", "tokens", "artifacts"]);
const SAC_THEMES = new Set(["aristocrats", "sacrifice"]);
const SAC_RULES = new Set(["sac-outlet-death-trigger", "treasure-sac-payoff"]);

export interface GraphInput {
  commanders: Card[];
  cards: Card[];
  themes: DeckTheme[];
  combos: DetectedCombo[];
  roles: Map<string, FunctionalCategory[]>;
}

function kindForRule(ruleId: string, weight: number): SynergyEdgeKind {
  if (weight >= 5) return "combo";
  if (SAC_RULES.has(ruleId)) return "sacrifice";
  if (ruleId === "token-doubler" || ruleId === "artifact-token-replacement") return "token";
  // Cross-theme relationships (Food feeds lifegain) are real but broad.
  return weight >= 2 ? "strong" : "theme";
}

function kindForTheme(themeId: string): SynergyEdgeKind {
  if (TOKEN_THEMES.has(themeId)) return "token";
  if (SAC_THEMES.has(themeId)) return "sacrifice";
  return "enabler-payoff";
}

export function buildSynergyGraph(input: GraphInput): SynergyGraph {
  const all = [...input.commanders, ...input.cards].filter((c) => !isLand(c));
  const commanderIds = new Set(input.commanders.map((c) => c.id));
  const texts = new Map(all.map((c) => [c.id, rulesText(c)]));
  const byName = new Map(all.map((c) => [c.name.toLowerCase(), c]));
  const edges = new Map<string, SynergyEdge>();
  const nodeThemes = new Map<string, Set<string>>();

  const addEdge = (a: Card, b: Card, kind: SynergyEdgeKind, weight: number, label: string) => {
    if (a.id === b.id) return;
    const [s, t] = a.id < b.id ? [a, b] : [b, a];
    const key = `${s.id}|${t.id}`;
    const existing = edges.get(key);
    if (existing) {
      // Keep the most specific relationship; accumulate weight.
      const rank: Record<SynergyEdgeKind, number> = { combo: 5, strong: 4, sacrifice: 3, token: 3, "enabler-payoff": 2, theme: 1 };
      existing.weight += weight * 0.5;
      if (rank[kind] > rank[existing.kind]) {
        existing.kind = kind;
        existing.label = label;
      }
      return;
    }
    edges.set(key, { source: s.id, target: t.id, kind, weight, label });
  };

  // 1. Interaction rules
  for (const rule of INTERACTION_RULES) {
    const sources = all.filter((c) => rule.source(c, texts.get(c.id)!));
    if (!sources.length) continue;
    const sourceIds = new Set(sources.map((c) => c.id));
    const targets = all.filter((c) => !sourceIds.has(c.id) && rule.target(c, texts.get(c.id)!));
    const weight = rule.weight ?? 1;
    for (const s of sources) for (const t of targets) addEdge(s, t, kindForRule(rule.id, weight), weight, rule.title);
  }

  // 2. Theme enabler → payoff
  for (const theme of input.themes) {
    const def = THEME_BY_ID[theme.id] ?? THEMES.find((t) => t.id === theme.id);
    const roles = new Map(theme.cards.map((c) => [c.name.toLowerCase(), c.role]));
    const members = theme.cards.map((c) => byName.get(c.name.toLowerCase())).filter((c): c is Card => !!c);
    for (const m of members) nodeThemes.set(m.id, (nodeThemes.get(m.id) ?? new Set()).add(theme.id));
    const enablers = members.filter((c) => roles.get(c.name.toLowerCase()) !== "payoff");
    const payoffs = members.filter((c) => roles.get(c.name.toLowerCase()) !== "enabler");
    const w = 0.4 + (theme.score / 100) * 1.2;
    const kind = theme.id.startsWith("typal-") ? "theme" : kindForTheme(theme.id);
    const label = def ? `${def.name}: enabler → payoff` : `${theme.name}: enabler → payoff`;
    for (const e of enablers) {
      for (const p of payoffs) {
        if (e.id === p.id) continue;
        addEdge(e, p, kind, w, label);
      }
    }
    // Payoffs of the same theme compound each other (weaker, "theme" kind).
    if (theme.score >= 30 && payoffs.length <= 12) {
      for (let i = 0; i < payoffs.length; i++) {
        for (let j = i + 1; j < payoffs.length; j++) addEdge(payoffs[i], payoffs[j], "theme", w * 0.4, `${theme.name}: shared payoff`);
      }
    }
  }

  // 3. Known combos
  for (const combo of input.combos) {
    if (combo.type === "near") continue;
    const cards = [...combo.present, ...combo.optionalPresent].map((n) => byName.get(n.toLowerCase())).filter((c): c is Card => !!c);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        addEdge(cards[i], cards[j], "combo", combo.type === "infinite" ? 6 : 3, combo.definition.name);
      }
    }
  }

  // Prune: keep the strongest edges per node; never drop combo/strong edges.
  const perNode = new Map<string, SynergyEdge[]>();
  for (const e of edges.values()) {
    perNode.set(e.source, [...(perNode.get(e.source) ?? []), e]);
    perNode.set(e.target, [...(perNode.get(e.target) ?? []), e]);
  }
  const keep = new Set<SynergyEdge>();
  for (const list of perNode.values()) {
    list.sort((a, b) => b.weight - a.weight);
    list.forEach((e, i) => {
      if (i < MAX_PER_NODE || e.kind === "combo" || e.kind === "strong") keep.add(e);
    });
  }
  let kept = [...keep].sort((a, b) => b.weight - a.weight);
  if (kept.length > MAX_EDGES) kept = kept.slice(0, MAX_EDGES);

  const degree = new Map<string, number>();
  for (const e of kept) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + e.weight);
    degree.set(e.target, (degree.get(e.target) ?? 0) + e.weight);
  }

  const nodes: SynergyNode[] = all.map((c) => ({
    id: c.id,
    name: c.name,
    isCommander: commanderIds.has(c.id),
    themes: [...(nodeThemes.get(c.id) ?? [])],
    roles: input.roles.get(c.name) ?? [],
    degree: Math.round((degree.get(c.id) ?? 0) * 100) / 100,
  }));

  return { nodes, edges: kept };
}

/** Edges touching a node, strongest first. */
export function neighborsOf(graph: SynergyGraph, nodeId: string): { edge: SynergyEdge; other: SynergyNode }[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((edge) => ({ edge, other: byId.get(edge.source === nodeId ? edge.target : edge.source)! }))
    .filter((x) => x.other)
    .sort((a, b) => b.edge.weight - a.edge.weight);
}

export const EDGE_KIND_LABELS: Record<SynergyEdgeKind, string> = {
  strong: "Strong Synergy",
  theme: "Theme Synergy",
  combo: "Combo Relationship",
  "enabler-payoff": "Enabler → Payoff",
  token: "Token Relationship",
  sacrifice: "Sacrifice Relationship",
};
