"use client";

/**
 * Deck Sandbox: experiment with adds, removes and upgrade packages without
 * touching the saved deck. Changes live in the session store until the user
 * saves them as a new version of this deck or as a new deck.
 */
import { FlaskConical, GitCompare, Minus, Plus, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Card, Deck, DeckAnalysis } from "@/lib/types";
import { analyzeDeck } from "@/lib/analysis/analyze";
import { diffCardLists } from "@/lib/analysis/compare";
import { applySandbox, cardCounts, describeChange } from "@/lib/deck/sandbox";
import { duplicateDeck } from "@/lib/deck/operations";
import { addVersion, createVersion } from "@/lib/deck/versions";
import { commanderIdentity } from "@/lib/rules/commander";
import { isWithinIdentity } from "@/lib/rules/commander";
import { useDeckStore } from "@/lib/state/deck-store";
import { useSandbox, useSandboxStore } from "@/lib/state/sandbox-store";
import { toast } from "@/lib/state/toast-store";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { CompareTable } from "@/components/analysis/compare-table";
import { CardSearchBox } from "@/components/mtg/card-search-box";
import { CardHoverPreview } from "@/components/mtg/card-hover-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/feedback";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/components/ui/utils";

export function SandboxPanel({ deck, analysis, onOpenCard }: { deck: Deck; analysis: DeckAnalysis; onOpenCard: (name: string) => void }) {
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const state = useSandbox(deck.id);
  const store = useSandboxStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveOpen, setSaveOpen] = useState<"version" | "deck" | null>(null);
  const identity = commanderIdentity(deck.commanders.map((c) => c.card));

  const sandboxDeck = useMemo(() => applySandbox(deck, state), [deck, state]);
  const sandboxAnalysis = useMemo(() => (state.changes.length ? analyzeDeck(sandboxDeck, currency) : analysis), [sandboxDeck, state.changes.length, analysis, currency]);
  const diff = useMemo(() => diffCardLists(cardCounts(deck), cardCounts(sandboxDeck)), [deck, sandboxDeck]);
  const dirty = state.changes.length > 0;

  function add(card: Card) {
    store.push(deck.id, { kind: "add", card, quantity: 1 });
    toast(`Added ${card.name} to the sandbox.`, "success");
  }

  return (
    <div className="grid gap-4">
      <Callout tone="info" title="Sandbox mode">
        Everything here is experimental. Your saved deck stays untouched until you choose <strong>Save as new version</strong> or <strong>Save as new deck</strong>.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-4">
          <Panel>
            <PanelHeader as="h3" title="Add a card" icon={<Plus />} description="Try a card without committing to it." />
            <PanelBody>
              <CardSearchBox
                onSelect={add}
                label="Card to try"
                placeholder="Search Scryfall…"
                validate={(c) => (identity.length && !isWithinIdentity(c, identity) ? `${c.name} is outside your color identity.` : null)}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              as="h3"
              title="Changes"
              icon={<FlaskConical />}
              description={dirty ? `${state.changes.length} change${state.changes.length === 1 ? "" : "s"} applied` : "No changes yet"}
              actions={
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Undo" disabled={!dirty} onClick={() => store.undo(deck.id)}>
                    <Undo2 />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Redo" disabled={!state.redo.length} onClick={() => store.redo(deck.id)}>
                    <Redo2 />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Reset sandbox" disabled={!dirty} onClick={() => setConfirmReset(true)}>
                    <RotateCcw />
                  </Button>
                </div>
              }
            />
            <PanelBody className="grid gap-1.5">
              {!dirty && <p className="text-xs text-muted">Add a card here, remove one from the sandbox list, use Test Cut on a card, or send an upgrade package from the Upgrade Workshop.</p>}
              {state.changes.map((ch, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-raised/60 px-2.5 py-1.5 text-xs">
                  <span className="truncate text-ink-2">{describeChange(ch)}</span>
                  <Badge tone={ch.kind === "add" ? "ok" : ch.kind === "remove" ? "danger" : "gold"}>{ch.kind}</Badge>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader as="h3" title="Save" icon={<Save />} />
            <PanelBody className="grid gap-2">
              <Button variant="primary" disabled={!dirty} onClick={() => setSaveOpen("version")}>
                <Save /> Save sandbox as new version
              </Button>
              <Button variant="secondary" disabled={!dirty} onClick={() => setSaveOpen("deck")}>
                <Plus /> Save sandbox as new deck
              </Button>
              <p className="text-[11px] text-muted">Saving as a new version updates this deck and records the change. Saving as a new deck leaves this deck exactly as it is.</p>
            </PanelBody>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel>
            <PanelHeader as="h3" title="Original vs. Sandbox" icon={<GitCompare />} description={dirty ? `${diff.added.length} added, ${diff.removed.length} removed, ${diff.unchanged.length} unchanged` : "Metrics update as you make changes."} />
            <PanelBody className="grid gap-4">
              {dirty && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <DiffList title="Added" names={diff.added} tone="ok" onOpenCard={onOpenCard} />
                  <DiffList title="Removed" names={diff.removed} tone="danger" onOpenCard={onOpenCard} />
                </div>
              )}
              <CompareTable before={analysis} after={sandboxAnalysis} labels={["Original", "Sandbox"]} onlyChanged={dirty} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader as="h3" title="Sandbox deck" description={`${sandboxDeck.cards.reduce((n, d) => n + ((d.board ?? "main") === "main" ? d.quantity : 0), 0)} cards. Click a card to open it, or use the minus to remove it from the sandbox.`} />
            <PanelBody>
              <ul className="grid gap-0.5 sm:grid-cols-2 xl:grid-cols-3">
                {sandboxDeck.cards
                  .filter((d) => (d.board ?? "main") === "main")
                  .sort((a, b) => a.card.name.localeCompare(b.card.name))
                  .map((d) => {
                    const added = diff.added.includes(d.card.name);
                    return (
                      <li key={d.card.oracleId} className={cn("flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[13px]", added && "bg-ok/10 text-ok")}>
                        <CardHoverPreview card={d.card}>
                          <button type="button" onClick={() => onOpenCard(d.card.name)} className="min-w-0 truncate text-left hover:text-gold-strong">
                            {d.quantity > 1 ? `${d.quantity}× ` : ""}
                            {d.card.name}
                          </button>
                        </CardHoverPreview>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.card.name} in sandbox`} onClick={() => store.push(deck.id, { kind: "remove", oracleId: d.card.oracleId, name: d.card.name, quantity: 1 })}>
                          <Minus />
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the sandbox?"
        description="All experimental changes will be discarded. Your saved deck is not affected."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          store.reset(deck.id);
          toast("Sandbox reset.", "info");
        }}
      />
      <SaveSandboxDialog mode={saveOpen} onClose={() => setSaveOpen(null)} deck={deck} sandboxDeck={sandboxDeck} sandboxAnalysis={sandboxAnalysis} diff={diff} />
    </div>
  );
}

function DiffList({ title, names, tone, onOpenCard }: { title: string; names: string[]; tone: "ok" | "danger"; onOpenCard: (n: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">{title}</p>
      {names.length ? (
        <ul className="flex flex-wrap gap-1">
          {names.map((n) => (
            <li key={n}>
              <button type="button" onClick={() => onOpenCard(n)} className={cn("rounded-md border px-2 py-0.5 text-xs hover:brightness-125", tone === "ok" ? "border-ok/40 text-ok" : "border-danger/40 text-danger")}>
                {n}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-muted">None</span>
      )}
    </div>
  );
}

function SaveSandboxDialog({
  mode,
  onClose,
  deck,
  sandboxDeck,
  sandboxAnalysis,
  diff,
}: {
  mode: "version" | "deck" | null;
  onClose: () => void;
  deck: Deck;
  sandboxDeck: Deck;
  sandboxAnalysis: DeckAnalysis;
  diff: { added: string[]; removed: string[] };
}) {
  const router = useRouter();
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const edit = useDeckEditor(deck);
  const reset = useSandboxStore((s) => s.reset);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const versionNumber = (deck.versions?.length ?? 0) + 1;

  async function save() {
    if (mode === "version") {
      const merged: Deck = { ...sandboxDeck, updatedAt: Date.now() };
      const version = createVersion(merged, sandboxAnalysis, notes, name || undefined, cardCounts(deck));
      edit(() => addVersion(merged, version));
      reset(deck.id);
      toast(`Saved as version ${version.number}.`, "success");
    } else {
      const copy = duplicateDeck(sandboxDeck, name || `${deck.name} (sandbox)`);
      const version = createVersion(copy, sandboxAnalysis, notes || `Forked from ${deck.name}`, `${copy.name} — v1`, cardCounts(deck));
      await saveDeck(addVersion(copy, version));
      reset(deck.id);
      toast(`Created "${copy.name}".`, "success");
      router.push(`/decks/${copy.id}`);
    }
    onClose();
    setName("");
    setNotes("");
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={mode === "version" ? `Save as version ${versionNumber}` : "Save as new deck"} description={`${diff.added.length} card${diff.added.length === 1 ? "" : "s"} added, ${diff.removed.length} removed.`}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <Label htmlFor="sb-name">{mode === "version" ? "Version name (optional)" : "Deck name"}</Label>
            <Input id="sb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "version" ? `${deck.name} — v${versionNumber}` : `${deck.name} (sandbox)`} />
          </div>
          <div>
            <Label htmlFor="sb-notes">Notes</Label>
            <Textarea id="sb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you change and why?" rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Save /> {mode === "version" ? "Save version" : "Create deck"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
