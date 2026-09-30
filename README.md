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
| `npm test` | Unit tests (Vitest) for parsing, rules, analysis, roles and tags, mana, combos and win conditions, synergy, upgrades, protections, sandbox, versions, simulation and playtest insights |
| `npm run test:e2e` | Playwright end-to-end tests of the import → analyze → edit → upgrade → save workflow and the Phase 2 Deck Doctor / Sandbox / History / Playtest workflow (build first) |

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

### Phase 2: Deck Doctor, smarter recommendations and playtesting

- **Deck Doctor** (main navigation and a tab on every deck): a structured report of what the deck is trying to do. Commander strategy, detected archetypes with primary and secondary strategies, likely game plan, strengths, potential weaknesses, mana concerns, role coverage (card advantage, interaction, ramp, protection, recursion, finishers) against typical guidelines, win conditions with an "unclear" flag and manual corrections, synergy packages, Combos & Engines, and cards that look poorly connected to the strategy. Findings use tentative language ("Potential concern", "Consider testing").
- **Deck Intent**: desired power level, primary strategy (auto-detected, overridable), secondary strategies, player priorities, upgrade philosophy (Preserve Theme / Balanced / Maximum Optimization) and free-text **deck goals**. Everything is stored on the deck and materially changes recommendations. Goals are read deterministically for strategy words, theme words and phrases like "not generic" or "more consistent"; the whole text is passed to any future advisor.
- **Roles and tags with confidence**: cards hold several functional roles (Ramp, Card Advantage, Enabler, Payoff, Drain, Mana Fixing…) and thematic tags (Food, Lifegain, Sacrifice, Token…), each with a reason and a confidence score. Manual additions and removals override detection per deck.
- **Synergy tab**: an interactive graph of meaningful mechanical relationships (no edges for shared colors or types). Click a card to highlight what it works with; filter by Strong, Theme, Combo, Enabler → Payoff, Token and Sacrifice edges. The engine keeps only the strongest relationships per card so the graph stays readable.
- **Combos & Engines**: a name-based `ComboDefinition` database (2-card and 3-card combos, value engines, near-combos missing one card) with pluggable sources, displayed as Infinite Combo, Value Engine or Strong Synergy.
- **Upgrade Recommendation Engine 2.0**: every add, cut and swap explains itself in terms of this deck's themes, packages, gaps and intent. Generic staples score lower under Preserve Theme or when the goals say so. **Locked** cards are never cut, **Favorite** cards only under Maximum Optimization, **Flavor Essential** cards weigh theme fit heavily. "Try in Sandbox" sends an accepted package to the deck's Sandbox.
- **Card actions**: "Why is this card here?" (roles, tags, strongest links, packages and a plain-language explanation) and **Test Cut** (recomputes the whole analysis without the card and shows a before/after table, nothing saved).
- **Sandbox**: add, remove and swap cards experimentally with undo, redo and reset. An Original vs. Sandbox table updates live. Save the result as a new version of the deck or as a new deck; the saved deck never changes otherwise.
- **Version history**: snapshots with date, notes, added/removed cards and summary stats; compare any two versions (ADDED / REMOVED / UNCHANGED plus stat differences).
- **Playtest notes and insights**: record games (players, result, length, opening hand, mana issues, cards that performed well / underperformed / stuck in hand, strategy notes, tags). Insights such as "mana problems in 3 of your last 5 games" always show their sample size and only appear past a minimum number of games.
- **Opening hand simulator**: draw 7, London mulligan, keep, draw the next card, restart, with land count, mana sources, ramp, draw, interaction and castability. "Draw 100 sample hands" shows the land distribution (0–5+) and how often ramp, draw and interaction appear. Seeded and labelled as simulation.
- **Mana Base Doctor** (Analysis tab): colored demand vs. production per color with hybrid (half each), Phyrexian, MDFC land faces, multi-color lands and colorless costs, land count and suggested range, untapped vs. tapped vs. conditional lands, rocks, dorks, land ramp, Treasure makers, fixers and cost reducers.
- **Commander dashboard**: both partners' artwork, text, identity, detected strategies, top themes and intent at the top of every deck.
- **DeckAdvisor** interface (`lib/advisor`) for a future AI layer. The local implementation is heuristic; no API keys ship to the client and the app never pretends to be AI.

## Architecture

```
src/
  app/                 Routes (thin; compose components)
  components/
    ui/                Buttons, panels, dialogs, tabs, tooltips…
    mtg/               Mana symbols, card image, card detail, protections, card explainer
    doctor/ synergy/ sandbox/ history/ playtest/   Phase 2 views
    decks/ builder/ analysis/ search/ upgrade/ layout/
  lib/
    types.ts           Card, DeckCard, Commander, Deck, DeckAnalysis, DeckTheme,
                       DeckRecommendation, UpgradeSuggestion…
    scryfall/          HTTP client (rate-limited queue, retries, de-duplication,
                       response cache), persistent card cache, API, query builder
    deck/              Parser, Scryfall resolver, immutable deck operations, sample deck
    rules/commander.ts All Commander legality: size, singleton, identity, pairing
    analysis/          Stats, roles (categories.ts), tags, mana doctor, win conditions,
                       deck health, deck/analysis comparison, analyzeDeck orchestrator
    synergy/           Theme definitions, interaction rules, engine, graph, packages
    combo/             ComboDefinition database and matching engine
    doctor/            Strategy detection and the Deck Doctor report builder
    upgrade/           Candidate queries, intent-aware scoring, cut ranking, swap planning
    deck/intent.ts     Deck intent defaults, goal parsing, priority weights
    deck/sandbox.ts    Reversible sandbox changes applied over a saved deck
    deck/versions.ts   Version snapshots, change log, version comparison
    playtest/          Playtest insight analyzer
    simulation/        Seeded opening-hand simulator
    advisor/           DeckAdvisor interface and local heuristic implementation
    storage/           Repository interfaces + localStorage implementation
    state/             Zustand stores and hooks
```

Key decisions:

- **Scryfall etiquette.** Every request goes through one serial queue spaced 100 ms apart (Scryfall asks for ≤10 requests/second), retries 429/5xx with backoff, and de-duplicates identical GETs. Resolved cards are cached in memory and localStorage for three days, so re-opening or re-importing a deck doesn't refetch.
- **Decks are self-contained.** Each deck stores a compact snapshot of its cards, so reopening a deck and analysing it need no network, and analysis runs synchronously in a few milliseconds.
- **Heuristics are data.** Functional categories (`lib/analysis/categories.ts`), themes (`lib/synergy/themes.ts`) and interactions (`lib/synergy/interactions.ts`) are lists of rules that read oracle text, types and keywords, never card names. Add a rule by appending to the list. Users can correct categories per card.
- **Swapping storage.** The UI only talks to `DeckRepository` / `PreferencesRepository` (`lib/storage/repository.ts`). To move to Supabase/PostgreSQL, implement those interfaces and return them from `getRepositories()` in `lib/storage/index.ts`.
- **Deck Health is advisory.** Thresholds live in `HEALTH_THRESHOLDS` and messages are phrased as suggestions.
- **Analysis is pure and modular.** `analyzeDeck` composes small engines (roles, tags, mana, combos, win conditions, graph, packages); `buildDoctorReport` composes their output into findings. Each module documents its heuristics and thresholds (`MANA_THRESHOLDS`, `CLEAR_THRESHOLD`, `MIN_PACKAGE_SCORE`, `INSIGHT_THRESHOLDS`) at the top of the file. None of it imports React.
- **Combos are the one name-based list.** Everything else reads rules text; the combo database is explicit card names by design and accepts extra sources through `registerComboSource`.
- **Nothing is hardcoded to the sample deck.** Frodo & Sam is a fixture for tests and a demo; protections, recommendations and findings come from the rules and the user's own settings.

Card data and images © Wizards of the Coast, provided by Scryfall. Commander Workshop is unofficial Fan Content and is not affiliated with Wizards of the Coast or Scryfall.
