"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Crown, LoaderCircle, ScrollText, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { Card, Deck } from "@/lib/types";
import { importDecklist } from "@/lib/deck/import";
import { createDeck } from "@/lib/deck/operations";
import type { ParseError } from "@/lib/deck/parser";
import { parseDecklist } from "@/lib/deck/parser";
import { SAMPLE_DECKLIST, SAMPLE_DECK_NAME } from "@/lib/deck/sample";
import { deckSize, validateDeck } from "@/lib/rules/commander";
import { describeScryfallError } from "@/lib/scryfall";
import { useDeckStore } from "@/lib/state/deck-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { CommanderPicker } from "./commander-picker";
import { UnresolvedList } from "./unresolved-list";

const PLACEHOLDER = `Commander
1 Frodo, Adventurous Hobbit (LTC) 2
1 Sam, Loyal Attendant (LTC) 90

Deck
1 Sol Ring
1 Birds of Paradise
1 Academy Manufactor
1 Swords to Plowshares
…`;

export function NewDeckForm() {
  const router = useRouter();
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const setPreferences = useDeckStore((s) => s.setPreferences);
  const [name, setName] = useState("");
  const [commanders, setCommanders] = useState<Card[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deck: Deck; parseErrors: ParseError[] } | null>(null);

  const parsed = useMemo(() => parseDecklist(text), [text]);
  const lineCount = parsed.entries.reduce((n, e) => n + e.quantity, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const deckName = name.trim() || (commanders[0] ? `${commanders[0].name.split(",")[0]} Deck` : "New Deck");
      let deck: Deck;
      let parseErrors: ParseError[] = [];
      if (text.trim()) {
        const res = await importDecklist(text, { name: deckName, commanders, onProgress: (d, t) => setProgress([d, t]) });
        deck = res.deck;
        parseErrors = res.parseErrors;
        if (!res.resolvedCount && res.deck.unresolved.length) {
          setError("None of the cards could be found on Scryfall. Check the list format or your connection.");
        }
      } else {
        deck = createDeck(deckName, commanders);
      }
      if (!name.trim() && deck.commanders[0] && !commanders.length) {
        deck = { ...deck, name: `${deck.commanders[0].card.name.split(",")[0]} Deck` };
      }
      await saveDeck(deck);
      await setPreferences({ activeDeckId: deck.id });
      if (!text.trim()) {
        router.push(`/decks/${deck.id}`);
        return;
      }
      setResult({ deck, parseErrors });
    } catch (err) {
      setError(describeScryfallError(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (result) return <ImportSummary deck={result.deck} parseErrors={result.parseErrors} />;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Panel className="h-fit">
        <PanelHeader title="Commander" icon={<Crown />} description="Choose one commander, or two with Partner, Background and similar." />
        <PanelBody className="grid gap-5">
          <div>
            <Label htmlFor="deck-name">Deck name</Label>
            <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Second Breakfast" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-2">Commander(s)</p>
            <CommanderPicker value={commanders} onChange={setCommanders} />
            <p className="mt-2 text-[11px] text-muted">You can skip this if your list has a “Commander” section.</p>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Decklist"
          icon={<ScrollText />}
          description="One card per line. Works with exports from Moxfield, Archidekt, MTGA and most other sites."
          actions={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(SAMPLE_DECKLIST);
                if (!name) setName(SAMPLE_DECK_NAME);
              }}
            >
              Use sample Frodo &amp; Sam list
            </Button>
          }
        />
        <PanelBody className="grid gap-4">
          <div>
            <Label htmlFor="decklist">Paste decklist</Label>
            <Textarea
              id="decklist"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="min-h-[420px]"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-muted" aria-live="polite">
              {lineCount ? `${lineCount} cards across ${parsed.entries.length} lines` : "Lines like “1 Sol Ring” or “1 Frodo, Adventurous Hobbit (LTC) 2” are supported."}
              {parsed.errors.length > 0 && <span className="text-warn"> · {parsed.errors.length} line(s) can&apos;t be read</span>}
            </p>
          </div>
          {error && <Callout tone="error">{error}</Callout>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {progress && (
              <span className="text-xs text-muted" aria-live="polite">
                Looking up cards on Scryfall… {progress[0]}/{progress[1]}
              </span>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {text.trim() ? "Import deck" : "Create empty deck"}
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}

function ImportSummary({ deck, parseErrors }: { deck: Deck; parseErrors: ParseError[] }) {
  const issues = validateDeck(deck).filter((i) => i.code !== "unresolved");
  const size = deckSize(deck);
  return (
    <Panel className="mx-auto max-w-3xl animate-rise">
      <PanelHeader title={`Imported “${deck.name}”`} description={`${size} cards recognized, including commanders.`} />
      <PanelBody className="grid gap-4">
        {deck.unresolved.length === 0 && parseErrors.length === 0 ? (
          <Callout tone="success" title="Every card was recognized." />
        ) : (
          <UnresolvedList unresolved={deck.unresolved} parseErrors={parseErrors} />
        )}
        {issues.map((i) => (
          <Callout key={i.code} tone={i.severity === "error" ? "warning" : "info"}>
            {i.message}
          </Callout>
        ))}
        <div className="flex justify-end">
          <Button asChild variant="primary" size="lg">
            <Link href={`/decks/${deck.id}`}>
              Open in Deck Builder <ArrowRight />
            </Link>
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
