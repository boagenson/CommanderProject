"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Card } from "@/lib/types";
import { autocomplete, describeScryfallError, getCardByName } from "@/lib/scryfall";
import { cn } from "@/components/ui/utils";

/**
 * Accessible card-name combobox backed by Scryfall autocomplete.
 * Debounced, cancels stale requests, and resolves the chosen name to a card.
 */
export function CardSearchBox({
  onSelect,
  placeholder = "Search for a card…",
  label = "Card name",
  className,
  autoFocus,
  validate,
}: {
  onSelect: (card: Card) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  /** Return an error message to reject a card (e.g. not a legal commander). */
  validate?: (card: Card) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const names = await autocomplete(q, controller.signal);
        setOptions(names.slice(0, 12));
        setOpen(true);
        setActive(names.length ? 0 : -1);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(describeScryfallError(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function choose(name: string) {
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const card = await getCardByName(name);
      const problem = validate?.(card);
      if (problem) {
        setError(problem);
        return;
      }
      onSelect(card);
      setQuery("");
      setOptions([]);
    } catch (err) {
      setError(describeScryfallError(err));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const name = options[active] ?? (query.trim().length > 1 ? query.trim() : null);
      if (name) void choose(name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setOptions([]);
              setOpen(false);
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => options.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="h-10 w-full rounded-lg border border-line bg-bg-raised pl-9 pr-9 text-sm text-ink placeholder:text-muted/80 hover:border-line-strong focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/25"
        />
        {loading && <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-label="Loading" />}
      </div>
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line-strong bg-panel-2 p-1 shadow-2xl"
        >
          {options.map((name, i) => (
            <li
              key={name}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active ? "bg-gold-soft text-gold-strong" : "text-ink-2")}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
