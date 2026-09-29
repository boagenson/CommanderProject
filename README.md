# Commander Workshop

A Magic: The Gathering Commander deckbuilding, analysis and upgrade tool. Paste or build a deck, see how it's put together, find its themes and weak spots, and plan budget upgrades you approve one swap at a time.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI primitives, Recharts and the [Scryfall API](https://scryfall.com/docs/api).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Then click **Load sample deck** on the dashboard (Frodo & Sam, a Food / lifegain / artifact-token deck) or **New Deck** to paste your own list.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Vitest) for the parser, rules, analysis, synergy and upgrade engines |
| `npm run test:e2e` | Playwright end-to-end test of the full import → analyze → edit → upgrade → save workflow (build first) |

Tests run against recorded Scryfall-shaped fixtures in `tests/fixtures/cards.ts`, so they work offline. The app itself always uses live Scryfall data.

## Features

- **Dashboard** of saved decks with commander art (both halves for partners), color identity, card count, average mana value, estimated value and last edit.
- **Deck import** from plain lists, MTGA/Moxfield (`1 Frodo, Adventurous Hobbit (LTC) 2`), Archidekt tags and `*CMDR*` markers, with section headers. Cards resolve through Scryfall in batches of 75; unknown lines get a fuzzy retry and are listed clearly instead of failing the import.
- **Commander picker** that understands Partner, Partner with, Friends forever, Choose a Background and Doctor's companion.
- **Deck Builder** with type sections and counts, list and visual views, in-deck filtering, quantity controls with singleton warnings, locking, and a card detail panel (image, cost, oracle text, P/T, identity, legality, set, rarity, price, Scryfall link, category corrections).
- **Card Search** across name, colors, color identity, mana value, type, rules text, set, rarity, Commander legality, price and keyword, with Add to Deck. With a deck selected, results are limited to (or sorted by) the commander's identity.
- **Analysis**: mana curve without lands, card types, card colors, pip demand vs. mana sources, mana production, average mana value, functional categories and Deck Health diagnostics. Every chart has a table view.
- **Themes & synergies**: Food, Treasure, Clues, Artifacts, Tokens, +1/+1 Counters, Lifegain, Aristocrats, Sacrifice, Graveyard, Spellslinger, Equipment, Enchantments, Landfall and creature typal, plus explained card-to-card interactions (for example, Academy Manufactor turning every Food, Treasure or Clue into one of each).
- **Upgrade Workshop**: budget ($10/$25/$50/$100/custom), strategy (Casual → High Power) and goals. It proposes REMOVE → ADD swaps with price, mana value and category changes and a short explanation. Locked cards and commanders are never cut. Accept, reject or accept all, then compare current vs. proposed before committing. Nothing changes until you commit.
- **Settings**: defaults, currency, JSON backup/restore and card-cache clearing.

## Architecture

```
src/
  app/                 Routes (thin; compose components)
  components/
    ui/                Buttons, panels, dialogs, tabs, tooltips…
    mtg/               Mana symbols, card image, card detail, card search box
    decks/ builder/ analysis/ search/ upgrade/ layout/
  lib/
    types.ts           Card, DeckCard, Commander, Deck, DeckAnalysis, DeckTheme,
                       DeckRecommendation, UpgradeSuggestion…
    scryfall/          HTTP client (rate-limited queue, retries, de-duplication,
                       response cache), persistent card cache, API, query builder
    deck/              Parser, Scryfall resolver, immutable deck operations, sample deck
    rules/commander.ts All Commander legality: size, singleton, identity, pairing
    analysis/          Stats, functional categories (heuristic rule list), deck health
    synergy/           Theme definitions, interaction rules, engine
    upgrade/           Candidate queries, scoring, cut ranking, swap planning
    storage/           Repository interfaces + localStorage implementation
    state/             Zustand stores and hooks
```

Key decisions:

- **Scryfall etiquette.** Every request goes through one serial queue spaced 100 ms apart (Scryfall asks for ≤10 requests/second), retries 429/5xx with backoff, and de-duplicates identical GETs. Resolved cards are cached in memory and localStorage for three days, so re-opening or re-importing a deck doesn't refetch.
- **Decks are self-contained.** Each deck stores a compact snapshot of its cards, so reopening a deck and analysing it need no network, and analysis runs synchronously in a few milliseconds.
- **Heuristics are data.** Functional categories (`lib/analysis/categories.ts`), themes (`lib/synergy/themes.ts`) and interactions (`lib/synergy/interactions.ts`) are lists of rules that read oracle text, types and keywords, never card names. Add a rule by appending to the list. Users can correct categories per card.
- **Swapping storage.** The UI only talks to `DeckRepository` / `PreferencesRepository` (`lib/storage/repository.ts`). To move to Supabase/PostgreSQL, implement those interfaces and return them from `getRepositories()` in `lib/storage/index.ts`.
- **Deck Health is advisory.** Thresholds live in `HEALTH_THRESHOLDS` and messages are phrased as suggestions.

Card data and images © Wizards of the Coast, provided by Scryfall. Commander Workshop is unofficial Fan Content and is not affiliated with Wizards of the Coast or Scryfall.
