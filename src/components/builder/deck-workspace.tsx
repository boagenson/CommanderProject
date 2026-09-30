"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChartColumn,
  CircleCheck,
  ClipboardList,
  Copy,
  Crown,
  FlaskConical,
  Hammer,
  History,
  Link2,
  LoaderCircle,
  Pencil,
  Sparkles,
  Stethoscope,
  Trash2,
  TriangleAlert,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Card, Deck, DeckAnalysis, DeckDoctorReport } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { importDecklist } from "@/lib/deck/import";
import { getIntent } from "@/lib/deck/intent";
import {
  addCard,
  exportDecklist,
  removeCard,
  setCategoryOverride,
  setCommanders,
  setProtection,
  setQuantity,
  setTagOverride,
} from "@/lib/deck/operations";
import { STRATEGY_DESCRIPTIONS } from "@/lib/doctor/strategy";
import { commanderIdentity, deckSize, COMMANDER_DECK_SIZE } from "@/lib/rules/commander";
import { describeScryfallError } from "@/lib/scryfall";
import { useDeckById, useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { useAnalysis } from "@/lib/state/use-analysis";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";
import { ThemesPanel } from "@/components/analysis/themes-panel";
import { CommanderPicker } from "@/components/decks/commander-picker";
import { DeckDoctor, useDoctorReport } from "@/components/doctor/deck-doctor";
import { VersionHistory } from "@/components/history/version-history";
import { CardDetailDialog } from "@/components/mtg/card-detail";
import { CardArt, CardImage } from "@/components/mtg/card-image";
import { ColorPips } from "@/components/mtg/mana";
import { OracleText } from "@/components/mtg/oracle-text";
import { HandSimulator } from "@/components/playtest/hand-simulator";
import { PlaytestPanel } from "@/components/playtest/playtest-panel";
import { SandboxPanel } from "@/components/sandbox/sandbox-panel";
import { SynergyGraphView } from "@/components/synergy/synergy-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Callout, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeckEditor } from "./deck-editor";

const TABS = ["cards", "doctor", "analysis", "themes", "synergy", "sandbox", "history", "playtest"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);

export function DeckWorkspace({ id }: { id: string }) {
  const { deck, loaded } = useDeckById(id);
  const analysis = useAnalysis(deck);
  const report = useDoctorReport(deck, analysis);
  const setPreferences = useDeckStore((s) => s.setPreferences);
  const activeDeckId = useDeckStore((s) => s.preferences.activeDeckId);
  const [tab, setTab] = useState<Tab>("cards");
  const [detail, setDetail] = useState<Card | null>(null);
  const edit = useDeckEditor(deck);

  useEffect(() => {
    if (deck && activeDeckId !== deck.id) void setPreferences({ activeDeckId: deck.id });
  }, [deck, activeDeckId, setPreferences]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab from URL hash once on mount
    if (isTab(hash)) setTab(hash);
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (!loaded) return <Skeleton className="h-64 rounded-2xl" />;
  if (!deck || !analysis || !report) {
    return (
      <EmptyState icon={<Hammer />} title="Deck not found" action={<Button asChild variant="primary"><Link href="/decks">Back to decks</Link></Button>}>
        This deck may have been deleted, or it was saved in a different browser.
      </EmptyState>
    );
  }

  const detailEntry = detail ? deck.cards.find((d) => d.card.oracleId === detail.oracleId) : undefined;
  const commanderEntry = detail ? deck.commanders.find((c) => c.card.oracleId === detail.oracleId) : undefined;
  const isCommander = !!commanderEntry;
  const openByName = (name: string) => setDetail(findCard(deck, name));

  return (
    <div className="grid gap-6">
      <DeckHeader deck={deck} analysis={analysis} report={report} errors={analysis.validation.filter((v) => v.severity === "error").length} price={analysis.totalPrice} />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          history.replaceState(null, "", `#${v}`);
        }}
      >
        <TabsList aria-label="Deck views" className="mb-4">
          <TabsTrigger value="cards">
            <Hammer /> Cards
          </TabsTrigger>
          <TabsTrigger value="doctor">
            <Stethoscope /> Deck Doctor
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <ChartColumn /> Analysis
          </TabsTrigger>
          <TabsTrigger value="themes">
            <Sparkles /> Themes
          </TabsTrigger>
          <TabsTrigger value="synergy">
            <Link2 /> Synergy
          </TabsTrigger>
          <TabsTrigger value="sandbox">
            <FlaskConical /> Sandbox
          </TabsTrigger>
          <TabsTrigger value="history">
            <History /> History
          </TabsTrigger>
          <TabsTrigger value="playtest">
            <ClipboardList /> Playtest
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cards">
          <DeckEditor deck={deck} analysis={analysis} onOpenCard={setDetail} />
        </TabsContent>
        <TabsContent value="doctor">
          <DeckDoctor deck={deck} analysis={analysis} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="analysis">
          <AnalysisDashboard deck={deck} analysis={analysis} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="themes">
          <ThemesPanel themes={analysis.themes} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="synergy">
          <SynergyGraphView graph={analysis.graph} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="sandbox">
          <SandboxPanel deck={deck} analysis={analysis} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="history">
          <VersionHistory deck={deck} analysis={analysis} onOpenCard={openByName} />
        </TabsContent>
        <TabsContent value="playtest">
          <div className="grid gap-6">
            <HandSimulator deck={deck} onOpenCard={openByName} />
            <PlaytestPanel deck={deck} onOpenCard={openByName} />
          </div>
        </TabsContent>
      </Tabs>

      <CardDetailDialog
        card={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        actions={{
          deckCard: detailEntry ?? (commanderEntry && { ...commanderEntry, quantity: 1 }),
          isCommander,
          identity: commanderIdentity(deck.commanders.map((c) => c.card)),
          onProtection: detailEntry ? (level, on) => edit((d) => setProtection(d, detailEntry.card.oracleId, level, on)) : undefined,
          onTag: detailEntry || commanderEntry ? (tag, state) => edit((d) => setTagOverride(d, detail!.oracleId, tag, state)) : undefined,
          deck,
          analysis,
          onOpenCard: openByName,
          onRemove: detailEntry
            ? () => {
                edit((d) => removeCard(d, detailEntry.card.oracleId, detailEntry.board ?? "main"));
                setDetail(null);
              }
            : undefined,
          onQuantity: detailEntry ? (q) => edit((d) => setQuantity(d, detailEntry.card.oracleId, q)) : undefined,
          onCategory:
            detailEntry || commanderEntry
              ? (cat, state) => edit((d) => setCategoryOverride(d, detail!.oracleId, cat, state))
              : undefined,
          onAdd: !detailEntry && !isCommander && detail ? () => edit((d) => addCard(d, detail)) : undefined,
        }}
      />
    </div>
  );
}

function findCard(deck: Deck, name: string): Card | null {
  return deck.commanders.find((c) => c.card.name === name)?.card ?? deck.cards.find((d) => d.card.name === name)?.card ?? null;
}

function DeckHeader({ deck, analysis, report, errors, price }: { deck: Deck; analysis: DeckAnalysis; report: DeckDoctorReport; errors: number; price: number }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const intent = getIntent(deck);
  const strategies = [report.primary, ...report.secondary].filter((s): s is NonNullable<typeof s> => !!s).slice(0, 3);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const edit = useDeckEditor(deck);
  const identity = useMemo(() => commanderIdentity(deck.commanders.map((c) => c.card)), [deck.commanders]);
  const size = deckSize(deck);
  const [first, second] = deck.commanders;

  async function remove() {
    const removed = await deleteDeck(deck.id);
    router.push("/decks");
    if (removed) toast(`Deleted "${removed.name}".`, "info", { label: "Undo", onClick: () => void saveDeck(removed) });
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(exportDecklist(deck));
      toast("Decklist copied to clipboard.", "success");
    } catch {
      toast("Couldn't access the clipboard.", "error");
    }
  }

  return (
    <header className="relative overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_20px_50px_#0008] animate-rise">
      <div className="absolute inset-0">
        {second ? (
          <div className="grid h-full grid-cols-2">
            <CardArt card={first.card} className="size-full" />
            <CardArt card={second.card} className="size-full" />
          </div>
        ) : (
          <CardArt card={first?.card} className="size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 pb-6 pt-16 sm:px-8 sm:pt-24">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <Crown className="size-3.5 text-gold" aria-hidden />
            {deck.commanders.length ? deck.commanders.map((c) => c.card.name).join(" & ") : "No commander selected"}
          </p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{deck.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ColorPips colors={identity} />
            <Badge tone={size === COMMANDER_DECK_SIZE ? "neutral" : "warn"}>
              {size}/{COMMANDER_DECK_SIZE} cards
            </Badge>
            {price > 0 && <Badge tone="neutral">{formatPrice(price, currency)}</Badge>}
            {errors === 0 ? (
              <Badge tone="ok">
                <CircleCheck /> Commander legal
              </Badge>
            ) : (
              <Badge tone="danger">
                <TriangleAlert /> {errors} rules issue{errors === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditDeckDialog deck={deck} onSave={(next) => edit(() => next)} />
          <ImportDialog deck={deck} />
          <Button variant="secondary" size="sm" onClick={copyList}>
            <Copy /> Export
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href={`/upgrade?deck=${deck.id}`}>
              <WandSparkles /> Upgrade
            </Link>
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Delete deck">
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="relative border-t border-line/60 bg-panel/80 px-6 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {strategies.map((s, i) => (
            <Badge key={s.name} tone={i === 0 ? "gold" : "neutral"}>
              {i === 0 ? "Primary: " : ""}
              {s.name}
            </Badge>
          ))}
          {analysis.themes.slice(0, 3).map((t) => (
            <Badge key={t.id} tone="info">{t.name}</Badge>
          ))}
          <Badge tone="neutral">{intent.power}</Badge>
          <button type="button" onClick={() => setExpanded((e) => !e)} className="ml-auto text-xs text-gold-strong hover:underline" aria-expanded={expanded}>
            {expanded ? "Hide commander details" : "Commander details"}
          </button>
        </div>
        {expanded && (
          <div className="mt-4 grid gap-4">
            <div className={`grid gap-4 ${second ? "lg:grid-cols-2" : ""}`}>
              {deck.commanders.map((c) => (
                <div key={c.card.oracleId} className="flex gap-4 rounded-2xl border border-line bg-bg-raised/70 p-3">
                  <div className="w-28 shrink-0 sm:w-36">
                    <CardImage card={c.card} size="normal" />
                  </div>
                  <div className="min-w-0 grid content-start gap-2 text-sm">
                    <p className="font-display text-base text-ink">{c.card.name}</p>
                    <p className="text-xs text-ink-2">{c.card.typeLine}</p>
                    <ColorPips colors={c.card.colorIdentity} size="sm" />
                    <OracleText text={c.card.oracleText} className="text-[13px] leading-relaxed text-ink-2" />
                    <div className="flex flex-wrap gap-1">
                      {(analysis.cardCategories[c.card.name]?.tags ?? []).map((t) => (
                        <Badge key={t.value} tone="info">{t.value}</Badge>
                      ))}
                      {(analysis.cardCategories[c.card.name]?.roles ?? []).slice(0, 3).map((r) => (
                        <Badge key={r.value} tone="gold">{r.value}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">Strategy</p>
                <p className="mt-1 text-ink-2">{report.commanderStrategy}</p>
                {report.primary && <p className="mt-1 text-xs text-muted">{STRATEGY_DESCRIPTIONS[report.primary.name]}</p>}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">Game plan</p>
                <p className="mt-1 text-ink-2">{report.gamePlan}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">Deck intent</p>
                <p className="mt-1 text-ink-2">
                  {intent.power} · {intent.primaryStrategy ?? report.primary?.name ?? "strategy auto-detected"} · {intent.philosophy}
                </p>
                {intent.goals.trim() && <p className="mt-1 line-clamp-3 text-xs text-muted">&ldquo;{intent.goals.trim()}&rdquo;</p>}
                <Link href="#doctor" className="mt-1 inline-block text-xs text-gold-strong hover:underline">
                  Edit in Deck Doctor
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${deck.name}"?`}
        description="The deck, its versions and playtest notes will be removed. You can undo from the toast right after."
        confirmLabel="Delete deck"
        destructive
        onConfirm={() => void remove()}
      />
    </header>
  );
}

function EditDeckDialog({ deck, onSave }: { deck: Deck; onSave: (deck: Deck) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(deck.name);
  const [commanders, setCmdrs] = useState<Card[]>(deck.commanders.map((c) => c.card));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(deck.name);
          setCmdrs(deck.commanders.map((c) => c.card));
        }
      }}
    >
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DialogContent title="Edit deck" description="Rename the deck or change commanders.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...setCommanders(deck, commanders), name: name.trim() || deck.name });
            setOpen(false);
          }}
        >
          <div>
            <Label htmlFor="edit-name">Deck name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Commander(s)</p>
            <CommanderPicker value={commanders} onChange={setCmdrs} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ deck }: { deck: Deck }) {
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { deck: next, resolvedCount } = await importDecklist(text, { base: deck, replace });
      await saveDeck(next);
      toast(`Imported ${resolvedCount} line${resolvedCount === 1 ? "" : "s"}.`, "success");
      setOpen(false);
      setText("");
    } catch (err) {
      setError(describeScryfallError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload /> Import
      </Button>
      <DialogContent title="Import cards" description="Paste a decklist to add to this deck, or replace its contents.">
        <div className="grid gap-3">
          <Label htmlFor="import-text">Decklist</Label>
          <Textarea id="import-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={"1 Sol Ring\n1 Academy Manufactor"} spellCheck={false} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-[var(--gold)]" />
            Replace the current cards (commanders are kept)
          </label>
          {error && <Callout tone="error">{error}</Callout>}
          <div className="flex justify-end">
            <Button variant="primary" onClick={run} disabled={busy || !text.trim()}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />} Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
