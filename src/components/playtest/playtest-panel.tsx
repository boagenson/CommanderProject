"use client";

/**
 * Playtest notes and insights. Entries are stored on the deck; insights are
 * computed by the playtest analyzer and always show their sample size.
 */
import { ClipboardList, Lightbulb, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Deck, PlaytestEntry, PlaytestResult, PlaytestTag } from "@/lib/types";
import { PLAYTEST_RESULTS, PLAYTEST_TAGS } from "@/lib/types";
import { addPlaytest, newId, removePlaytest } from "@/lib/deck/operations";
import { INSIGHT_THRESHOLDS, playtestInsights } from "@/lib/playtest/analyzer";
import { toast } from "@/lib/state/toast-store";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { CardNameField } from "./card-name-field";

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { dateStyle: "medium" });

interface Draft {
  date: string;
  players: string;
  result: PlaytestResult | "";
  turns: string;
  openingHand: string;
  manaIssues: string;
  performedWell: string[];
  underperformed: string[];
  stuckInHand: string[];
  strategyNotes: string;
  notes: string;
  tags: PlaytestTag[];
}

const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  players: "4",
  result: "",
  turns: "",
  openingHand: "",
  manaIssues: "",
  performedWell: [],
  underperformed: [],
  stuckInHand: [],
  strategyNotes: "",
  notes: "",
  tags: [],
});

export function PlaytestPanel({ deck, onOpenCard }: { deck: Deck; onOpenCard: (name: string) => void }) {
  const edit = useDeckEditor(deck);
  const entries = useMemo(() => deck.playtests ?? [], [deck.playtests]);
  const insights = useMemo(() => playtestInsights(entries), [entries]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(entries.length === 0);
  const [toDelete, setToDelete] = useState<PlaytestEntry | null>(null);
  const names = useMemo(() => [...deck.commanders.map((c) => c.card.name), ...deck.cards.map((d) => d.card.name)].sort(), [deck]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const entry: PlaytestEntry = {
      id: newId(),
      date: new Date(`${draft.date}T12:00:00`).getTime() || Date.now(),
      players: Number(draft.players) || undefined,
      result: draft.result || undefined,
      turns: Number(draft.turns) || undefined,
      openingHand: draft.openingHand.trim() || undefined,
      manaIssues: draft.manaIssues.trim() || undefined,
      performedWell: draft.performedWell,
      underperformed: draft.underperformed,
      stuckInHand: draft.stuckInHand,
      strategyNotes: draft.strategyNotes.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      tags: draft.tags,
    };
    edit((d) => addPlaytest(d, entry));
    toast("Game recorded.", "success");
    setDraft(emptyDraft());
    setFormOpen(false);
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-4">
        <Panel>
          <PanelHeader
            as="h3"
            title="Record a game"
            icon={<ClipboardList />}
            description="Every field is optional. Tags and card names feed the insights on the right."
            actions={
              <Button size="sm" variant={formOpen ? "ghost" : "primary"} onClick={() => setFormOpen((o) => !o)}>
                <Plus /> {formOpen ? "Hide form" : "New game"}
              </Button>
            }
          />
          {formOpen && (
            <PanelBody>
              <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label htmlFor="pt-date">Date</Label>
                    <Input id="pt-date" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pt-players">Players</Label>
                    <Input id="pt-players" type="number" min={2} max={8} value={draft.players} onChange={(e) => set("players", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pt-result">Result</Label>
                    <Select id="pt-result" value={draft.result} onChange={(e) => set("result", e.target.value as PlaytestResult | "")}>
                      <option value="">—</option>
                      {PLAYTEST_RESULTS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pt-turns">Game length (turns)</Label>
                    <Input id="pt-turns" type="number" min={1} max={40} value={draft.turns} onChange={(e) => set("turns", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="pt-hand">Opening hand</Label>
                    <Textarea id="pt-hand" rows={2} value={draft.openingHand} onChange={(e) => set("openingHand", e.target.value)} placeholder="3 lands, Sol Ring, Frodo turn 2…" />
                  </div>
                  <div>
                    <Label htmlFor="pt-mana">Mana issues</Label>
                    <Textarea id="pt-mana" rows={2} value={draft.manaIssues} onChange={(e) => set("manaIssues", e.target.value)} placeholder="Missed a white source until turn 5…" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <CardNameField label="Cards that performed well" names={names} value={draft.performedWell} onChange={(v) => set("performedWell", v)} />
                  <CardNameField label="Cards that underperformed" names={names} value={draft.underperformed} onChange={(v) => set("underperformed", v)} />
                  <CardNameField label="Cards stuck in hand" names={names} value={draft.stuckInHand} onChange={(v) => set("stuckInHand", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAYTEST_TAGS.map((tag) => (
                      <ToggleChip key={tag} pressed={draft.tags.includes(tag)} onPressedChange={(p) => set("tags", p ? [...draft.tags, tag] : draft.tags.filter((t) => t !== tag))}>
                        {tag}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="pt-strategy">Strategy notes</Label>
                    <Textarea id="pt-strategy" rows={3} value={draft.strategyNotes} onChange={(e) => set("strategyNotes", e.target.value)} placeholder="Held up protection instead of committing; should have gone wider on turn 4." />
                  </div>
                  <div>
                    <Label htmlFor="pt-notes">General notes</Label>
                    <Textarea id="pt-notes" rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary">
                    <Plus /> Save game
                  </Button>
                </div>
              </form>
            </PanelBody>
          )}
        </Panel>

        <Panel>
          <PanelHeader as="h3" title="Game log" description={entries.length ? `${entries.length} game${entries.length === 1 ? "" : "s"} recorded` : undefined} />
          <PanelBody className="grid gap-3">
            {!entries.length && (
              <EmptyState icon={<ClipboardList />} title="No games yet">
                Record a few games and Commander Workshop will start pointing out patterns.
              </EmptyState>
            )}
            {entries.map((e) => (
              <article key={e.id} className="rounded-xl border border-line bg-bg-raised/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <time className="text-ink" dateTime={new Date(e.date).toISOString()}>
                      {fmtDate(e.date)}
                    </time>
                    {e.result && <Badge tone={e.result === "Win" ? "ok" : e.result === "Loss" ? "danger" : "neutral"}>{e.result}</Badge>}
                    {e.players && <span className="text-xs text-muted">{e.players} players</span>}
                    {e.turns && <span className="text-xs text-muted">{e.turns} turns</span>}
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete game" onClick={() => setToDelete(e)}>
                    <Trash2 />
                  </Button>
                </div>
                {e.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <Badge key={t} tone="info">{t}</Badge>
                    ))}
                  </div>
                )}
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
                  {e.openingHand && <Row label="Opening hand">{e.openingHand}</Row>}
                  {e.manaIssues && <Row label="Mana">{e.manaIssues}</Row>}
                  {e.performedWell.length > 0 && <Row label="Performed well"><Names names={e.performedWell} onOpenCard={onOpenCard} tone="ok" /></Row>}
                  {e.underperformed.length > 0 && <Row label="Underperformed"><Names names={e.underperformed} onOpenCard={onOpenCard} tone="warn" /></Row>}
                  {e.stuckInHand.length > 0 && <Row label="Stuck in hand"><Names names={e.stuckInHand} onOpenCard={onOpenCard} tone="danger" /></Row>}
                  {e.strategyNotes && <Row label="Strategy">{e.strategyNotes}</Row>}
                  {e.notes && <Row label="Notes">{e.notes}</Row>}
                </dl>
              </article>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="h-fit">
        <PanelHeader as="h3" title="Insights" icon={<Lightbulb />} description={`Patterns across your last ${INSIGHT_THRESHOLDS.window} games. Each one shows how many games support it.`} />
        <PanelBody className="grid gap-2">
          {!insights.length && (
            <p className="text-sm text-muted">
              {entries.length < INSIGHT_THRESHOLDS.minGames ? `Record at least ${INSIGHT_THRESHOLDS.minGames} games to unlock trend insights. Card-level repeats appear after 2.` : "No recurring pattern stands out yet."}
            </p>
          )}
          {insights.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-bg-raised/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-ink">{i.title}</p>
                <Badge tone={i.severity === "warning" ? "warn" : i.severity === "error" ? "danger" : "neutral"}>
                  {i.support}/{i.total} games
                </Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{i.detail}</p>
              {i.cards && i.cards.length > 0 && (
                <div className="mt-1.5">
                  <Names names={i.cards} onOpenCard={onOpenCard} tone="warn" />
                </div>
              )}
            </div>
          ))}
        </PanelBody>
      </Panel>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this game?"
        description="The notes for this game will be removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (toDelete) edit((d) => removePlaytest(d, toDelete.id));
          setToDelete(null);
        }}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-ink-2">{children}</dd>
    </>
  );
}

function Names({ names, onOpenCard, tone }: { names: string[]; onOpenCard: (n: string) => void; tone: "ok" | "warn" | "danger" }) {
  const cls = tone === "ok" ? "border-ok/40 text-ok" : tone === "warn" ? "border-warn/40 text-warn" : "border-danger/40 text-danger";
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((n) => (
        <button key={n} type="button" onClick={() => onOpenCard(n)} className={`rounded-md border px-1.5 py-0.5 text-xs hover:brightness-125 ${cls}`}>
          {n}
        </button>
      ))}
    </span>
  );
}
