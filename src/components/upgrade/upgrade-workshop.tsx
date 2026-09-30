"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Coins, FlaskConical, LoaderCircle, Plus, RotateCcw, Save, Search, Shield, Target, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Card, Deck, DeckCard, ProtectionLevel, Strategy, UpgradeGoal, UpgradeOptions } from "@/lib/types";
import { STRATEGIES, UPGRADE_GOALS } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { getIntent } from "@/lib/deck/intent";
import { addCard, setProtection, swapCard, toggleLock } from "@/lib/deck/operations";
import { commanderIdentity } from "@/lib/rules/commander";
import { describeScryfallError } from "@/lib/scryfall";
import { generateUpgradePlan, type UpgradePlan } from "@/lib/upgrade";
import { useDecks, useDeckStore } from "@/lib/state/deck-store";
import { useSandboxStore } from "@/lib/state/sandbox-store";
import { toast } from "@/lib/state/toast-store";
import { useAnalysis } from "@/lib/state/use-analysis";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { CardDetailDialog } from "@/components/mtg/card-detail";
import { CardImage } from "@/components/mtg/card-image";
import { ProtectionBadges, ProtectionToggles } from "@/components/mtg/protection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { CompareView } from "./compare-view";
import { SwapCard, type SwapState } from "./swap-card";

const BUDGETS = [10, 25, 50, 100];

export function UpgradeWorkshop() {
  const params = useSearchParams();
  const { decks, loaded, preferences } = useDecks();
  const setPreferences = useDeckStore((s) => s.setPreferences);
  const deckId = params.get("deck") ?? preferences.activeDeckId ?? decks[0]?.id;
  const deck = decks.find((d) => d.id === deckId) ?? decks[0];

  if (!loaded) return <Skeleton className="h-96 rounded-2xl" />;
  if (!deck) {
    return (
      <EmptyState icon={<WandSparkles />} title="No deck to upgrade" action={<Button asChild variant="primary"><Link href="/decks/new"><Plus /> New Deck</Link></Button>}>
        Create or import a deck, then come back to plan upgrades.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-4">
      {decks.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="upgrade-deck" className="mb-0 shrink-0">
            Deck
          </Label>
          <Select
            id="upgrade-deck"
            className="max-w-sm"
            value={deck.id}
            onChange={(e) => {
              void setPreferences({ activeDeckId: e.target.value });
              history.replaceState(null, "", `/upgrade?deck=${e.target.value}`);
            }}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {/* Keyed so switching decks resets plan state. */}
      <Workshop key={deck.id} deck={deck} />
    </div>
  );
}

function Workshop({ deck }: { deck: Deck }) {
  const prefs = useDeckStore((s) => s.preferences);
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const edit = useDeckEditor(deck);
  const analysis = useAnalysis(deck)!;

  const [budgetPreset, setBudgetPreset] = useState<number | "custom">(BUDGETS.includes(prefs.defaultBudget) ? prefs.defaultBudget : "custom");
  const [customBudget, setCustomBudget] = useState(String(prefs.defaultBudget));
  const intent = getIntent(deck);
  const [strategy, setStrategy] = useState<Strategy>(deck.intent?.power ?? prefs.defaultStrategy);
  const [goals, setGoals] = useState<UpgradeGoal[]>(["More Synergy"]);
  const [maxSwaps, setMaxSwaps] = useState(8);
  const [plan, setPlan] = useState<UpgradePlan | null>(null);
  const [states, setStates] = useState<Record<string, SwapState>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);

  const budget = budgetPreset === "custom" ? Math.max(0, Number(customBudget) || 0) : budgetPreset;
  const lockedIds = useMemo(() => new Set(deck.cards.filter((d) => d.locked).map((d) => d.card.oracleId)), [deck.cards]);

  // Suggestions that became invalid (card locked/removed since) are hidden.
  const visible = useMemo(
    () => (plan?.suggestions ?? []).filter((s) => !lockedIds.has(s.remove.oracleId) && deck.cards.some((d) => d.card.oracleId === s.remove.oracleId)),
    [plan, lockedIds, deck.cards],
  );
  const accepted = visible.filter((s) => states[s.id] === "accepted");

  const proposed = useMemo(() => {
    if (!accepted.length) return null;
    let next = deck;
    for (const s of accepted) next = swapCard(next, s.remove.oracleId, s.add);
    return next;
  }, [deck, accepted]);
  const proposedAnalysis = useMemo(() => (proposed ? analyzeDeck(proposed, prefs.priceCurrency) : null), [proposed, prefs.priceCurrency]);

  async function generate() {
    setRunning(true);
    setError(null);
    setStates({});
    try {
      const options: UpgradeOptions = { budget, strategy, goals, maxSwaps, intent: { ...intent, power: strategy } };
      const result = await generateUpgradePlan(deck, analysis, options, { onProgress: (d, t) => setProgress([d, t]) });
      setPlan(result);
      if (result.errors.length && !result.suggestions.length) setError(result.errors.join(" "));
    } catch (err) {
      setError(describeScryfallError(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function commit() {
    if (!proposed) return;
    const before = deck;
    await saveDeck(proposed);
    toast(`Applied ${accepted.length} swap${accepted.length === 1 ? "" : "s"} to ${deck.name}.`, "success", {
      label: "Undo",
      onClick: () => void saveDeck({ ...before, updatedAt: Date.now() }),
    });
    setPlan((p) => (p ? { ...p, suggestions: p.suggestions.filter((s) => states[s.id] !== "accepted") } : p));
    setStates({});
  }

  const applyPackage = useSandboxStore((s) => s.applyPackage);
  const router = useRouter();
  function tryInSandbox() {
    if (!accepted.length) return;
    applyPackage(deck.id, accepted, "Upgrade package");
    toast(`Sent ${accepted.length} swap${accepted.length === 1 ? "" : "s"} to the Sandbox.`, "success");
    router.push(`/decks/${deck.id}#sandbox`);
  }

  const deckCardFor = (card: Card) => deck.cards.find((d) => d.card.oracleId === card.oracleId);
  const inDeck = new Set(deck.cards.map((d) => d.card.oracleId));
  const moreRecs = (plan?.recommendations ?? []).filter((r) => !visible.some((s) => s.add.oracleId === r.card.oracleId) && !inDeck.has(r.card.oracleId)).slice(0, 12);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="grid content-start gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto xl:pr-1">
        <Panel>
          <PanelHeader title="Upgrade plan" icon={<Target />} description={`${deck.name} · ${commanderIdentity(deck.commanders.map((c) => c.card)).join("") || "C"}`} />
          <PanelBody className="grid gap-5">
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2">
                <Coins className="size-3.5 text-gold" aria-hidden /> Upgrade budget
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {BUDGETS.map((b) => (
                  <ToggleChip key={b} pressed={budgetPreset === b} onPressedChange={() => setBudgetPreset(b)}>
                    ${b}
                  </ToggleChip>
                ))}
                <ToggleChip pressed={budgetPreset === "custom"} onPressedChange={() => setBudgetPreset("custom")}>
                  Custom
                </ToggleChip>
              </div>
              {budgetPreset === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-muted">$</span>
                  <Input aria-label="Custom budget in dollars" type="number" min={0} step={1} value={customBudget} onChange={(e) => setCustomBudget(e.target.value)} className="h-9 w-32" />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-muted">Total spent on added cards stays within {formatPrice(budget)}.</p>
            </fieldset>

            <div className="rounded-xl border border-gold/25 bg-gold-soft/20 p-3 text-xs">
              <p className="mb-1 flex items-center justify-between font-medium text-gold-strong">
                Deck intent
                <Link href={`/decks/${deck.id}#doctor`} className="font-normal text-gold-strong hover:underline">
                  Edit
                </Link>
              </p>
              <p className="text-ink-2">
                {intent.primaryStrategy ?? "Strategy auto-detected"}
                {intent.secondaryStrategies.length ? ` + ${intent.secondaryStrategies.join(", ")}` : ""} · {intent.philosophy}
              </p>
              {intent.priorities.length > 0 && <p className="mt-0.5 text-muted">Priorities: {intent.priorities.join(", ")}</p>}
              {intent.goals.trim() && <p className="mt-0.5 line-clamp-2 text-muted">&ldquo;{intent.goals.trim()}&rdquo;</p>}
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-2">Power level</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {STRATEGIES.map((s) => (
                  <ToggleChip key={s} pressed={strategy === s} onPressedChange={() => setStrategy(s)} className="justify-center">
                    {s}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-2">Goals</legend>
              <div className="flex flex-wrap gap-1.5">
                {UPGRADE_GOALS.map((g) => (
                  <ToggleChip key={g} pressed={goals.includes(g)} onPressedChange={(p) => setGoals((cur) => (p ? [...cur, g] : cur.filter((x) => x !== g)))}>
                    {g}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="max-swaps">Maximum swaps: {maxSwaps}</Label>
              <input id="max-swaps" type="range" min={1} max={15} value={maxSwaps} onChange={(e) => setMaxSwaps(Number(e.target.value))} className="w-full accent-[var(--gold)]" />
            </div>

            <Button variant="primary" size="lg" onClick={generate} disabled={running || !deck.commanders.length}>
              {running ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
              {running ? (progress ? `Searching Scryfall ${progress[0]}/${progress[1]}` : "Searching…") : plan ? "Regenerate suggestions" : "Generate suggestions"}
            </Button>
            {!deck.commanders.length && <p className="text-xs text-warn">Choose a commander first so suggestions respect its color identity.</p>}
          </PanelBody>
        </Panel>
        <ProtectedCards deck={deck} onChange={(id, level, on) => edit((d) => setProtection(d, id, level, on))} />
      </div>

      <div className="grid content-start gap-5">
        {error && <Callout tone="error">{error}</Callout>}
        {!plan && !running && (
          <EmptyState icon={<WandSparkles />} title="Plan your next upgrades">
            Set a budget, power level and goals, then generate suggestions. Every add, cut and swap comes with a reason specific to this deck and its intent. Nothing changes until you accept swaps and commit them, or try them in the Sandbox.
          </EmptyState>
        )}
        {running && !plan && <Skeleton className="h-96 rounded-2xl" />}

        {plan && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-ink">Proposed swaps</h2>
                <p className="text-sm text-muted">
                  {visible.length ? `${visible.length} suggestion${visible.length === 1 ? "" : "s"} · ${accepted.length} accepted` : "No swaps cleared the bar for this budget and these goals."}
                </p>
              </div>
              {visible.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setStates(Object.fromEntries(visible.map((s) => [s.id, "accepted" as SwapState])))}>
                    <CheckCheck /> Accept all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStates({})}>
                    <RotateCcw /> Reset
                  </Button>
                </div>
              )}
            </div>
            {plan.errors.length > 0 && visible.length > 0 && (
              <Callout tone="warning">Some searches failed, so suggestions may be incomplete: {plan.errors.join(" ")}</Callout>
            )}
            <ul className="grid gap-4 lg:grid-cols-2">
              {visible.map((s) => (
                <SwapCard
                  key={s.id}
                  swap={s}
                  state={states[s.id] ?? "pending"}
                  onAccept={() => setStates((st) => ({ ...st, [s.id]: st[s.id] === "accepted" ? "pending" : "accepted" }))}
                  onReject={() => setStates((st) => ({ ...st, [s.id]: st[s.id] === "rejected" ? "pending" : "rejected" }))}
                  onLockInstead={() => {
                    edit((d) => toggleLock(d, s.remove.oracleId));
                    toast(`Locked ${s.remove.name}. It won't be suggested as a cut.`, "success");
                  }}
                  onOpenCard={(side) => setDetail(side === "add" ? s.add : s.remove)}
                />
              ))}
            </ul>

            {proposed && proposedAnalysis && (
              <>
                <CompareView before={analysis} after={proposedAnalysis} goals={goals} />
                <Panel className="flex flex-wrap items-center justify-between gap-3 border-gold/40 p-4">
                  <p className="text-sm text-ink-2">
                    Preview ready: {accepted.length} accepted swap{accepted.length === 1 ? "" : "s"}, costing about{" "}
                    <span className="text-ink">{formatPrice(accepted.reduce((n, s) => n + (s.add.prices.usd ?? 0), 0))}</span>. Your deck hasn&apos;t changed yet.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={tryInSandbox}>
                      <FlaskConical /> Try in Sandbox
                    </Button>
                    <Button variant="primary" onClick={commit}>
                      <Save /> Commit changes
                    </Button>
                  </div>
                </Panel>
              </>
            )}

            {moreRecs.length > 0 && <MoreRecommendations recs={moreRecs} onOpen={setDetail} onAdd={(c) => edit((d) => addCard(d, c))} />}
          </>
        )}
      </div>

      <CardDetailDialog
        card={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        actions={
          detail
            ? {
                deckCard: deckCardFor(detail),
                identity: commanderIdentity(deck.commanders.map((c) => c.card)),
                onProtection: deckCardFor(detail) ? (level, on) => edit((d) => setProtection(d, detail.oracleId, level, on)) : undefined,
                deck,
                analysis,
              }
            : undefined
        }
      />
    </div>
  );
}

function ProtectedCards({ deck, onChange }: { deck: Deck; onChange: (oracleId: string, level: ProtectionLevel, on: boolean) => void }) {
  const [q, setQ] = useState("");
  const protectedCards = deck.cards.filter((d) => d.locked || d.favorite || d.flavorEssential);
  const matches = q.trim().length > 1 ? deck.cards.filter((d) => d.card.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  return (
    <Panel>
      <PanelHeader as="h3" title="Protected cards" icon={<Shield />} description="Locked cards are never cut. Favorites are cut only under Maximum Optimization. Flavor Essentials weigh theme fit heavily. Commanders are always safe." />
      <PanelBody className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Find a card to protect" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a card to protect…" className="pl-9" />
        </div>
        {matches.length > 0 && (
          <ul className="grid gap-1">
            {matches.map((d) => (
              <ProtectRow key={d.card.oracleId} dc={d} onChange={(level, on) => onChange(d.card.oracleId, level, on)} />
            ))}
          </ul>
        )}
        {protectedCards.length ? (
          <ul className="grid gap-1">
            {protectedCards
              .filter((d) => !matches.includes(d))
              .map((d) => (
                <ProtectRow key={d.card.oracleId} dc={d} onChange={(level, on) => onChange(d.card.oracleId, level, on)} />
              ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No protected cards yet. You can also mark cards from any card&apos;s detail view.</p>
        )}
      </PanelBody>
    </Panel>
  );
}

function ProtectRow({ dc, onChange }: { dc: DeckCard; onChange: (level: ProtectionLevel, on: boolean) => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-panel-3/60">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{dc.card.name}</span>
        <ProtectionBadges dc={dc} />
      </span>
      <ProtectionToggles dc={dc} onChange={onChange} compact />
    </li>
  );
}

function MoreRecommendations({ recs, onOpen, onAdd }: { recs: UpgradePlan["recommendations"]; onOpen: (c: Card) => void; onAdd: (c: Card) => void }) {
  return (
    <Panel>
      <PanelHeader title="More recommended cards" description="Cards that fit this deck's themes and gaps but didn't make a swap. Adding one doesn't cut anything." />
      <PanelBody>
        <ul className="grid gap-3 md:grid-cols-2">
          {recs.map((r) => (
            <li key={r.card.oracleId} className="flex gap-3 rounded-xl border border-line bg-bg-raised/70 p-3">
              <button type="button" onClick={() => onOpen(r.card)} className="w-16 shrink-0" aria-label={`Details for ${r.card.name}`}>
                <CardImage card={r.card} size="small" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm text-ink">{r.card.name}</p>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatPrice(r.card.prices.usd)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.themes.slice(0, 2).map((t) => (
                    <Badge key={t} tone="info">{t}</Badge>
                  ))}
                  {r.categories.slice(0, 2).map((c) => (
                    <Badge key={c} tone="gold">{c}</Badge>
                  ))}
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs text-ink-2">{r.reasons.slice(0, 2).join(" ")}</p>
                <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => onAdd(r.card)}>
                  <Plus /> Add to deck
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

