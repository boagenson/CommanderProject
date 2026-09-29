"use client";

import { Check, Filter, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Color } from "@/lib/types";
import { COLORS } from "@/lib/types";
import { COLOR_NAMES, formatPrice } from "@/lib/cards/helpers";
import { addCard } from "@/lib/deck/operations";
import { commanderIdentity, isWithinIdentity, quantityWarning } from "@/lib/rules/commander";
import { buildScryfallQuery, describeScryfallError, getSets, searchCards, type CardSearchFilters, type SearchOptions } from "@/lib/scryfall";
import type { ScryfallSet } from "@/lib/scryfall/types";
import { useDecks, useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { CardDetailDialog } from "@/components/mtg/card-detail";
import { CardImage } from "@/components/mtg/card-image";
import { ManaSymbol } from "@/components/mtg/mana";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { ToggleChip } from "@/components/ui/toggle-chip";

const EMPTY: CardSearchFilters = { commanderLegal: true, colorMode: "including" };

export function CardSearch() {
  const { decks, preferences } = useDecks();
  const saveDeck = useDeckStore((s) => s.saveDeck);
  const [deckId, setDeckId] = useState<string>("");
  const deck = decks.find((d) => d.id === (deckId || preferences.activeDeckId));
  const identity = useMemo(() => (deck ? commanderIdentity(deck.commanders.map((c) => c.card)) : null), [deck]);

  const [filters, setFilters] = useState<CardSearchFilters>(EMPTY);
  const [restrict, setRestrict] = useState(true);
  const [extra, setExtra] = useState("");
  const [order, setOrder] = useState<NonNullable<SearchOptions["order"]>>("edhrec");
  const [results, setResults] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<Card | null>(null);
  const [sets, setSets] = useState<ScryfallSet[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getSets()
      .then((s) => setSets(s.filter((x) => !["token", "memorabilia", "minigame"].includes(x.set_type))))
      .catch(() => undefined);
  }, []);

  const query = useMemo(() => {
    const f: CardSearchFilters = { ...filters, identity: deck && restrict && identity ? identity : filters.identity };
    return [buildScryfallQuery(f), extra.trim()].filter(Boolean).join(" ");
  }, [filters, extra, deck, restrict, identity]);

  const set = <K extends keyof CardSearchFilters>(k: K, v: CardSearchFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v === "" ? undefined : Number(v));

  async function run(nextPage = 1, sort = order) {
    if (!query.trim()) {
      setError("Add at least one filter to search.");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(query, { page: nextPage, order: sort, signal: controller.signal });
      setResults((prev) => (nextPage === 1 ? res.cards : [...prev, ...res.cards]));
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(nextPage);
      setSearched(true);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(describeScryfallError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  // Cards that fit the selected deck's identity come first.
  const ordered = useMemo(() => {
    if (!identity) return results;
    const fits = results.filter((c) => isWithinIdentity(c, identity));
    return [...fits, ...results.filter((c) => !isWithinIdentity(c, identity))];
  }, [results, identity]);

  const inDeck = useMemo(() => new Set(deck?.cards.map((d) => d.card.oracleId) ?? []), [deck]);

  async function add(card: Card) {
    if (!deck) {
      toast("Create or select a deck first.", "error");
      return;
    }
    // Read the latest saved deck so quick successive adds don't overwrite each other.
    const current = useDeckStore.getState().decks.find((d) => d.id === deck.id) ?? deck;
    const existing = current.cards.find((d) => d.card.oracleId === card.oracleId && (d.board ?? "main") === "main");
    const warning = existing ? quantityWarning(card, existing.quantity + 1) : null;
    if (warning) toast(warning, "error");
    if (identity && !isWithinIdentity(card, identity)) toast(`${card.name} is outside ${deck.name}'s color identity.`, "error");
    await saveDeck(addCard(current, card));
    if (!warning) toast(`Added ${card.name} to ${deck.name}.`, "success");
  }

  function toggleColor(list: Color[] | undefined, c: Color) {
    const cur = list ?? [];
    return cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Panel className="h-fit p-4 lg:sticky lg:top-6">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(1);
          }}
        >
          <h2 className="flex items-center gap-2 font-display text-base text-ink">
            <Filter className="size-4 text-gold" aria-hidden /> Filters
          </h2>

          <div>
            <Label htmlFor="deck-select">Adding to deck</Label>
            <Select id="deck-select" value={deck?.id ?? ""} onChange={(e) => setDeckId(e.target.value)}>
              {!decks.length && <option value="">No decks yet</option>}
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            {deck && identity && (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} className="accent-[var(--gold)]" />
                Only cards in {identity.length ? identity.join("") : "colorless"} identity
              </label>
            )}
          </div>

          <Field id="f-name" label="Name">
            <Input id="f-name" value={filters.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Manufactor" />
          </Field>
          <Field id="f-text" label="Rules text">
            <Input id="f-text" value={filters.text ?? ""} onChange={(e) => set("text", e.target.value)} placeholder='e.g. create a food token' />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="f-type" label="Type">
              <Input id="f-type" value={filters.type ?? ""} onChange={(e) => set("type", e.target.value)} placeholder="creature" />
            </Field>
            <Field id="f-kw" label="Keyword">
              <Input id="f-kw" value={filters.keyword ?? ""} onChange={(e) => set("keyword", e.target.value)} placeholder="lifelink" />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-ink-2">Colors</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => (
                <ToggleChip key={c} pressed={!!filters.colors?.includes(c)} onPressedChange={() => set("colors", toggleColor(filters.colors, c))} aria-label={COLOR_NAMES[c]} className="px-2">
                  <ManaSymbol symbol={c} className="text-base" />
                </ToggleChip>
              ))}
              <ToggleChip pressed={!!filters.colorless} onPressedChange={(p) => set("colorless", p)} className="px-2" aria-label="Colorless">
                <ManaSymbol symbol="C" className="text-base" />
              </ToggleChip>
            </div>
            <Select aria-label="Color match" className="mt-2 h-8 text-xs" value={filters.colorMode} onChange={(e) => set("colorMode", e.target.value as CardSearchFilters["colorMode"])}>
              <option value="including">Including these colors</option>
              <option value="exactly">Exactly these colors</option>
              <option value="atMost">At most these colors</option>
            </Select>
          </fieldset>

          {!(deck && restrict) && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-ink-2">Color identity (fits within)</legend>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <ToggleChip key={c} pressed={!!filters.identity?.includes(c)} onPressedChange={() => set("identity", toggleColor(filters.identity, c))} aria-label={`Identity ${COLOR_NAMES[c]}`} className="px-2">
                    <ManaSymbol symbol={c} className="text-base" />
                  </ToggleChip>
                ))}
                {filters.identity && (
                  <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => set("identity", undefined)}>
                    Clear
                  </button>
                )}
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field id="f-mvmin" label="Mana value min">
              <Input id="f-mvmin" type="number" min={0} inputMode="numeric" value={filters.mvMin ?? ""} onChange={(e) => set("mvMin", num(e.target.value))} />
            </Field>
            <Field id="f-mvmax" label="Mana value max">
              <Input id="f-mvmax" type="number" min={0} inputMode="numeric" value={filters.mvMax ?? ""} onChange={(e) => set("mvMax", num(e.target.value))} />
            </Field>
            <Field id="f-pmin" label="Price min ($)">
              <Input id="f-pmin" type="number" min={0} step="0.25" value={filters.priceMin ?? ""} onChange={(e) => set("priceMin", num(e.target.value))} />
            </Field>
            <Field id="f-pmax" label="Price max ($)">
              <Input id="f-pmax" type="number" min={0} step="0.25" value={filters.priceMax ?? ""} onChange={(e) => set("priceMax", num(e.target.value))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="f-set" label="Set">
              <Input id="f-set" list="set-list" value={filters.set ?? ""} onChange={(e) => set("set", e.target.value)} placeholder="ltc" />
              <datalist id="set-list">
                {sets.slice(0, 400).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field id="f-rarity" label="Rarity">
              <Select id="f-rarity" value={filters.rarity ?? ""} onChange={(e) => set("rarity", e.target.value as CardSearchFilters["rarity"])}>
                <option value="">Any</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="mythic">Mythic</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={!!filters.commanderLegal} onChange={(e) => set("commanderLegal", e.target.checked)} className="accent-[var(--gold)]" />
            Commander legal only
          </label>

          <Field id="f-extra" label="Extra Scryfall syntax (optional)">
            <Input id="f-extra" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. is:spell -t:creature" />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <Search />} Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY);
                setExtra("");
              }}
            >
              <X /> Reset
            </Button>
          </div>
          <p className="break-words font-mono text-[11px] text-muted" aria-live="polite">
            {query || "No filters yet"}
          </p>
        </form>
      </Panel>

      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2" aria-live="polite">
            {searched ? `${total.toLocaleString()} card${total === 1 ? "" : "s"} found` : "Set filters and search Scryfall."}
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="order" className="mb-0">
              Sort
            </Label>
            <Select
              id="order"
              className="h-9 w-40 text-xs"
              value={order}
              onChange={(e) => {
                const next = e.target.value as typeof order;
                setOrder(next);
                if (searched) void run(1, next);
              }}
            >
              <option value="edhrec">Commander popularity</option>
              <option value="name">Name</option>
              <option value="cmc">Mana value</option>
              <option value="usd">Price</option>
              <option value="released">Newest</option>
            </Select>
          </div>
        </div>

        {error && <Callout tone="error">{error}</Callout>}

        {loading && page === 1 && !results.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[488/680]" />
            ))}
          </div>
        ) : searched && !results.length && !error ? (
          <EmptyState icon={<Search />} title="No cards match">
            Try loosening a filter.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {ordered.map((card) => {
              const offColor = identity ? !isWithinIdentity(card, identity) : false;
              const owned = inDeck.has(card.oracleId);
              return (
                <li key={card.id} className="group grid gap-2 animate-rise">
                  <button type="button" onClick={() => setDetail(card)} className="block rounded-[4.75%/3.5%] transition-transform hover:-translate-y-1 focus-visible:-translate-y-1" aria-label={`Details for ${card.name}`}>
                    <CardImage card={card} className={offColor ? "opacity-60" : undefined} />
                  </button>
                  <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
                    <span className="truncate text-ink-2" title={card.name}>
                      {card.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{formatPrice(card.prices.usd)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant={owned ? "secondary" : "outline"} className="flex-1" onClick={() => add(card)} disabled={!deck}>
                      {owned ? <Check /> : <Plus />} {owned ? "In deck" : "Add to Deck"}
                    </Button>
                    {offColor && <Badge tone="warn">Off-color</Badge>}
                    {card.commanderLegality !== "legal" && <Badge tone="danger">Not legal</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => run(page + 1)} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : null} Load more
            </Button>
          </div>
        )}
      </div>

      <CardDetailDialog
        card={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        actions={detail && deck ? { identity: identity ?? undefined, onAdd: () => void add(detail) } : undefined}
      />
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
