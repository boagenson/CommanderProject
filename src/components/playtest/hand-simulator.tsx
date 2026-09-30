"use client";

/**
 * Opening Hand Simulator. Seeded so the same seed always produces the same
 * hand; results are labelled as simulation because they only describe what
 * the deck draws, not how a game plays out.
 */
import { Dices, Hand, RefreshCw, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Deck } from "@/lib/types";
import { commanderIdentity } from "@/lib/rules/commander";
import { drawCard, handStats, mulligan, newGame, simulateHands, type GameState } from "@/lib/simulation/engine";
import { CardHoverPreview } from "@/components/mtg/card-hover-preview";
import { CardImage } from "@/components/mtg/card-image";
import { ColorPips } from "@/components/mtg/mana";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export function HandSimulator({ deck, onOpenCard }: { deck: Deck; onOpenCard: (name: string) => void }) {
  const identity = useMemo(() => commanderIdentity(deck.commanders.map((c) => c.card)), [deck.commanders]);
  const [game, setGame] = useState<GameState | null>(null);
  const [kept, setKept] = useState(false);
  const [sample, setSample] = useState<ReturnType<typeof simulateHands> | null>(null);
  const librarySize = deck.cards.reduce((n, d) => n + ((d.board ?? "main") === "main" ? d.quantity : 0), 0);
  const stats = useMemo(() => (game ? handStats(game.hand, identity) : null), [game, identity]);

  if (librarySize < 7) {
    return (
      <EmptyState icon={<Hand />} title="Not enough cards to draw a hand">
        Add at least seven cards to the deck to simulate opening hands.
      </EmptyState>
    );
  }

  function start() {
    setGame(newGame(deck, randomSeed()));
    setKept(false);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeader
            as="h3"
            title="Opening hand"
            icon={<Hand />}
            description={game ? `Seed ${game.seed}${game.mulligans ? ` · ${game.mulligans} mulligan${game.mulligans === 1 ? "" : "s"}` : ""} · ${game.library.length} cards in library` : "Shuffle up and draw seven."}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {!game && (
                  <Button size="sm" variant="primary" onClick={start}>
                    <Shuffle /> Draw 7
                  </Button>
                )}
                {game && !kept && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setGame(mulligan(game, deck))} disabled={game.mulligans >= 6}>
                      <RefreshCw /> Mulligan to {Math.max(0, 6 - game.mulligans)}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => setKept(true)}>
                      Keep
                    </Button>
                  </>
                )}
                {game && kept && (
                  <Button size="sm" variant="primary" onClick={() => setGame(drawCard(game))} disabled={!game.library.length}>
                    Draw next card
                  </Button>
                )}
                {game && (
                  <Button size="sm" variant="ghost" onClick={start}>
                    <Shuffle /> Restart
                  </Button>
                )}
              </div>
            }
          />
          <PanelBody>
            {!game ? (
              <p className="text-sm text-muted">Simulates a London mulligan: each mulligan draws seven and keeps one fewer card.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {game.hand.map((card, i) => {
                  const drawn = i >= game.hand.length - game.drawn.length;
                  return (
                    <li key={`${card.oracleId}-${i}`} className={cn("relative animate-rise", drawn && "ring-2 ring-gold/60 rounded-[4.5%]")}>
                      <CardHoverPreview card={card}>
                        <button type="button" onClick={() => onOpenCard(card.name)} className="block w-full rounded-[4.5%] focus-visible:outline focus-visible:outline-gold">
                          <CardImage card={card} size="small" />
                        </button>
                      </CardHoverPreview>
                      {drawn && <span className="absolute left-1 top-1 rounded-full bg-black/75 px-1.5 text-[10px] text-gold-strong">drawn</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader as="h3" title="Hand info" description="Counts come from the same role detection used across the app." />
          <PanelBody>
            {stats ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Stat label="Lands" value={stats.lands} tone={stats.lands < 2 || stats.lands > 5 ? "warn" : "ok"} />
                <Stat label="Mana sources" value={stats.manaSources} />
                <Stat label="Ramp" value={stats.ramp} />
                <Stat label="Card draw" value={stats.cardDraw} />
                <Stat label="Interaction" value={stats.interaction} />
                <Stat label="Avg. mana value" value={stats.averageManaValue} />
                <Stat label="Castable by turn 3" value={stats.castableByTurn3} />
                <Stat label="Color-locked" value={stats.uncastableByColor} tone={stats.uncastableByColor ? "warn" : undefined} />
                <dt className="text-muted">Colors available</dt>
                <dd>{stats.colors.length ? <ColorPips colors={stats.colors} size="sm" /> : <span className="text-muted">none</span>}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted">Draw a hand to see its land count, mana sources and what you can cast early.</p>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          as="h3"
          title="Draw 100 sample hands"
          icon={<Dices />}
          description="Simulation only: shuffles the library 100 times and records the seven-card hand each time, before any mulligan."
          actions={
            <Button size="sm" variant="secondary" onClick={() => setSample(simulateHands(deck, identity, 100, randomSeed()))}>
              <Dices /> {sample ? "Draw another 100" : "Run simulation"}
            </Button>
          }
        />
        <PanelBody>
          {!sample ? (
            <p className="text-sm text-muted">See how often you draw a keepable number of lands, and how often ramp, draw and interaction show up.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">Lands in opening hand ({sample.hands} hands)</p>
                <ul className="grid gap-1.5">
                  {sample.landDistribution.map((n, lands) => (
                    <li key={lands} className="grid grid-cols-[3.5rem_1fr_4rem] items-center gap-2 text-xs">
                      <span className="text-ink-2">{lands === 5 ? "5+" : lands} land{lands === 1 ? "" : "s"}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-panel-3">
                        <span className={cn("block h-full rounded-full", lands >= 2 && lands <= 5 ? "bg-gold" : "bg-danger/70")} style={{ width: `${(n / sample.hands) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-ink">
                        {n} ({Math.round((n / sample.hands) * 100)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="grid content-start grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Stat label="Keepable (2–5 lands)" value={`${Math.round((sample.keepable / sample.hands) * 100)}%`} tone={sample.keepable / sample.hands >= 0.8 ? "ok" : "warn"} />
                <Stat label="Average lands" value={sample.averageLands} />
                <Stat label="Hands with ramp" value={`${Math.round((sample.withRamp / sample.hands) * 100)}%`} />
                <Stat label="Hands with draw" value={`${Math.round((sample.withDraw / sample.hands) * 100)}%`} />
                <Stat label="Hands with interaction" value={`${Math.round((sample.withInteraction / sample.hands) * 100)}%`} />
                <Stat label="Color trouble" value={`${Math.round((sample.colorTrouble / sample.hands) * 100)}%`} tone={sample.colorTrouble / sample.hands > 0.25 ? "warn" : undefined} />
                <Stat label="Average mana value" value={sample.averageManaValue} />
              </dl>
            </div>
          )}
          {sample && <Callout tone="info" className="mt-4">These are simulated draws from a shuffled library, not game outcomes. Sample size: {sample.hands} hands.</Callout>}
        </PanelBody>
      </Panel>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">
        {tone ? (
          <Tooltip content={tone === "ok" ? "Looks healthy" : "Worth a look"}>
            <span><Badge tone={tone}>{value}</Badge></span>
          </Tooltip>
        ) : (
          value
        )}
      </dd>
    </>
  );
}
