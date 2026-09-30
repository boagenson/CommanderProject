"use client";

/**
 * Interactive synergy graph. A small force simulation runs in a hook (no
 * extra dependency) and renders to SVG. Clicking a node highlights the cards
 * it synergizes with; filters hide edge kinds; noisy graphs are already
 * pruned by the engine to the strongest relationships.
 */
import { Filter, Link2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SynergyEdgeKind, SynergyGraph } from "@/lib/types";
import { SYNERGY_EDGE_KINDS } from "@/lib/types";
import { EDGE_KIND_LABELS, neighborsOf } from "@/lib/synergy/graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { cn } from "@/components/ui/utils";

const EDGE_COLORS: Record<SynergyEdgeKind, string> = {
  combo: "#e26a52",
  strong: "#e3bf72",
  sacrifice: "#b86aae",
  token: "#3fa35f",
  "enabler-payoff": "#72a7dc",
  theme: "#948a7d",
};

interface Pos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Deterministic force layout: nodes repel, edges attract, everything drifts to the centre. */
function useForceLayout(graph: SynergyGraph, width: number, height: number, iterations = 260) {
  return useMemo(() => {
    const pos = new Map<string, Pos>();
    const n = graph.nodes.length || 1;
    graph.nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2;
      const r = Math.min(width, height) * 0.38;
      pos.set(node.id, { x: width / 2 + Math.cos(angle) * r, y: height / 2 + Math.sin(angle) * r, vx: 0, vy: 0 });
    });
    const k = Math.sqrt((width * height) / n) * 0.9;
    // Deterministic jitter for coincident nodes so the layout is stable across renders.
    let jitterSeed = 7;
    const jitter = () => {
      jitterSeed = (jitterSeed * 1103515245 + 12345) % 2147483648;
      return jitterSeed / 2147483648 - 0.5;
    };
    for (let it = 0; it < iterations; it++) {
      const t = 1 - it / iterations;
      for (const a of graph.nodes) {
        const pa = pos.get(a.id)!;
        for (const b of graph.nodes) {
          if (a.id === b.id) continue;
          const pb = pos.get(b.id)!;
          let dx = pa.x - pb.x;
          let dy = pa.y - pb.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = jitter() * 2;
            dy = jitter() * 2;
            d2 = 1;
          }
          const f = (k * k) / d2;
          pa.vx += (dx / Math.sqrt(d2)) * f * 0.02;
          pa.vy += (dy / Math.sqrt(d2)) * f * 0.02;
        }
      }
      for (const e of graph.edges) {
        const pa = pos.get(e.source);
        const pb = pos.get(e.target);
        if (!pa || !pb) continue;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - k * 0.8) / d) * 0.02 * Math.min(2, e.weight);
        pa.vx += dx * f;
        pa.vy += dy * f;
        pb.vx -= dx * f;
        pb.vy -= dy * f;
      }
      for (const p of pos.values()) {
        p.vx += (width / 2 - p.x) * 0.004;
        p.vy += (height / 2 - p.y) * 0.004;
        p.x += Math.max(-12, Math.min(12, p.vx * t));
        p.y += Math.max(-12, Math.min(12, p.vy * t));
        p.vx *= 0.6;
        p.vy *= 0.6;
        p.x = Math.max(24, Math.min(width - 24, p.x));
        p.y = Math.max(24, Math.min(height - 24, p.y));
      }
    }
    return pos;
  }, [graph, width, height, iterations]);
}

export function SynergyGraphView({ graph, onOpenCard }: { graph: SynergyGraph; onOpenCard: (name: string) => void }) {
  const [kinds, setKinds] = useState<Set<SynergyEdgeKind>>(() => new Set(SYNERGY_EDGE_KINDS));
  const [selected, setSelected] = useState<string | null>(null);
  const [hideIsolated, setHideIsolated] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const height = 620;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo<SynergyGraph>(() => {
    const edges = graph.edges.filter((e) => kinds.has(e.kind));
    const connected = new Set(edges.flatMap((e) => [e.source, e.target]));
    const nodes = hideIsolated ? graph.nodes.filter((n) => connected.has(n.id) || n.isCommander) : graph.nodes;
    return { nodes, edges };
  }, [graph, kinds, hideIsolated]);

  const pos = useForceLayout(filtered, width, height);
  const neighbors = useMemo(() => (selected ? neighborsOf(filtered, selected) : []), [filtered, selected]);
  const neighborIds = new Set(neighbors.map((n) => n.other.id));
  const selectedNode = filtered.nodes.find((n) => n.id === selected);
  const maxDegree = Math.max(1, ...filtered.nodes.map((n) => n.degree));

  if (!graph.edges.length) {
    return (
      <EmptyState icon={<Link2 />} title="No synergies detected yet">
        Connections appear when cards share a mechanical relationship, such as a Food maker and a Food payoff. Colors and card types alone never create a connection.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      <Panel className="flex flex-wrap items-center gap-2 p-3">
        <Filter className="size-4 text-gold" aria-hidden />
        {SYNERGY_EDGE_KINDS.map((k) => (
          <ToggleChip
            key={k}
            pressed={kinds.has(k)}
            onPressedChange={(p) =>
              setKinds((cur) => {
                const next = new Set(cur);
                if (p) next.add(k);
                else next.delete(k);
                return next;
              })
            }
          >
            <span className="size-2 rounded-full" style={{ background: EDGE_COLORS[k] }} aria-hidden />
            {EDGE_KIND_LABELS[k]}
            <span className="text-[10px] text-muted">{graph.edges.filter((e) => e.kind === k).length}</span>
          </ToggleChip>
        ))}
        <ToggleChip pressed={hideIsolated} onPressedChange={setHideIsolated} className="ml-auto">
          Hide unconnected cards
        </ToggleChip>
        {selected && (
          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
            <RotateCcw /> Clear selection
          </Button>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden">
          <div ref={containerRef} className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Synergy graph with ${filtered.nodes.length} cards and ${filtered.edges.length} connections`} className="block select-none">
              <rect width={width} height={height} fill="transparent" onClick={() => setSelected(null)} />
              {filtered.edges.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const active = selected ? e.source === selected || e.target === selected : true;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={EDGE_COLORS[e.kind]}
                    strokeWidth={Math.min(4, 0.6 + e.weight * 0.5)}
                    strokeOpacity={selected ? (active ? 0.9 : 0.06) : 0.35}
                  >
                    <title>{`${e.label} (${EDGE_KIND_LABELS[e.kind]})`}</title>
                  </line>
                );
              })}
              {filtered.nodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const r = 5 + Math.sqrt(n.degree / maxDegree) * 11 + (n.isCommander ? 3 : 0);
                const dim = selected ? !(n.id === selected || neighborIds.has(n.id)) : false;
                const isSel = n.id === selected;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    className="cursor-pointer focus:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.name}: ${Math.round(n.degree * 10) / 10} synergy weight`}
                    onClick={() => setSelected(isSel ? null : n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(isSel ? null : n.id);
                      }
                    }}
                    opacity={dim ? 0.18 : 1}
                  >
                    <circle r={r} fill={n.isCommander ? "#c9a25a" : "#2d2731"} stroke={isSel ? "#e3bf72" : neighborIds.has(n.id) ? "#e3bf72" : "#4a4150"} strokeWidth={isSel ? 3 : 1.5} />
                    {(r > 9 || isSel || neighborIds.has(n.id)) && (
                      <text y={r + 11} textAnchor="middle" fontSize={10} fill={isSel ? "#e3bf72" : "#c7bda9"} style={{ paintOrder: "stroke", stroke: "#121013", strokeWidth: 3 }}>
                        {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                      </text>
                    )}
                    <title>{n.name}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        </Panel>

        <Panel>
          <PanelHeader as="h3" title={selectedNode ? selectedNode.name : "Select a card"} icon={<Link2 />} description={selectedNode ? `${neighbors.length} connection${neighbors.length === 1 ? "" : "s"} shown` : "Click a node to highlight the cards it works with. Node size reflects total synergy weight."} />
          <PanelBody className="grid gap-2">
            {selectedNode && (
              <>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.roles.slice(0, 4).map((r) => (
                    <Badge key={r} tone="gold">{r}</Badge>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={() => onOpenCard(selectedNode.name)}>
                  Why is this card here?
                </Button>
                <ul className="grid gap-1.5">
                  {neighbors.map(({ edge, other }) => (
                    <li key={other.id}>
                      <button type="button" onClick={() => setSelected(other.id)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-panel-3/60">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: EDGE_COLORS[edge.kind] }} aria-hidden />
                        <span className="min-w-0">
                          <span className={cn("block truncate text-sm text-ink")}>{other.name}</span>
                          <span className="block text-[11px] text-muted">{edge.label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!selectedNode && (
              <ul className="grid gap-1">
                <p className="text-[11px] uppercase tracking-wider text-muted">Most connected</p>
                {[...filtered.nodes]
                  .sort((a, b) => b.degree - a.degree)
                  .slice(0, 10)
                  .map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => setSelected(n.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm text-ink-2 hover:bg-panel-3/60 hover:text-ink">
                        <span className="truncate">{n.name}</span>
                        <span className="text-xs tabular-nums text-muted">{Math.round(n.degree * 10) / 10}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
