/**
 * Commander format rules. All legality logic lives here so UI components only
 * render the resulting `ValidationIssue`s. Update this module when the rules
 * change. Reference: https://mtgcommander.net/index.php/rules/
 */
import type { Card, Color, Deck, ValidationIssue } from "@/lib/types";
import { COLORS } from "@/lib/types";
import { isBasicLand, isLegendary, frontTypeLine } from "@/lib/cards/helpers";

export const COMMANDER_DECK_SIZE = 100;
export const MAX_COMMANDERS = 2;

export type PairingAbility =
  | { kind: "partner"; group?: string }
  | { kind: "partnerWith"; name: string }
  | { kind: "friendsForever" }
  | { kind: "chooseBackground" }
  | { kind: "background" }
  | { kind: "doctorsCompanion" }
  | { kind: "timeLordDoctor" };

/** Pairing abilities (Partner, Partner with, Backgrounds…) a card has. */
export function pairingAbilities(card: Card): PairingAbility[] {
  const out: PairingAbility[] = [];
  const text = card.oracleText;
  const lines = text.split("\n").map((l) => l.trim());
  for (const line of lines) {
    const withMatch = /^Partner with ([^(]+?)(?:\s*\(|$)/.exec(line);
    if (withMatch) {
      out.push({ kind: "partnerWith", name: withMatch[1].trim() });
      continue;
    }
    const groupMatch = /^Partner\s*[—-]\s*([^(]+?)(?:\s*\(|$)/.exec(line);
    if (groupMatch) {
      out.push({ kind: "partner", group: groupMatch[1].trim() });
      continue;
    }
    if (/^Partner(\s*\(|$)/.test(line)) out.push({ kind: "partner" });
    if (/^Friends forever(\s*\(|$)/.test(line)) out.push({ kind: "friendsForever" });
    if (/^Choose a Background(\s*\(|$)/.test(line)) out.push({ kind: "chooseBackground" });
    if (/^Doctor's companion(\s*\(|$)/.test(line)) out.push({ kind: "doctorsCompanion" });
  }
  const type = frontTypeLine(card);
  if (/\bBackground\b/.test(type) && /\bEnchantment\b/.test(type)) out.push({ kind: "background" });
  if (/\bTime Lord Doctor\b/.test(type)) out.push({ kind: "timeLordDoctor" });
  return out;
}

/** Whether a card may be a commander on its own (or as the partner half). */
export function canBeCommander(card: Card): boolean {
  const type = frontTypeLine(card);
  if (isLegendary(card) && /\bCreature\b/.test(type)) return true;
  if (/can be your commander/i.test(card.oracleText)) return true;
  // Backgrounds are only legal alongside a "Choose a Background" commander.
  return pairingAbilities(card).some((p) => p.kind === "background");
}

/** Whether this card can share the command zone with another commander. */
export function canHavePartner(card: Card): boolean {
  return pairingAbilities(card).length > 0;
}

/** Can these two cards be commanders together? */
export function canPairCommanders(a: Card, b: Card): boolean {
  if (a.oracleId === b.oracleId) return false;
  const pa = pairingAbilities(a);
  const pb = pairingAbilities(b);
  const has = (list: PairingAbility[], kind: PairingAbility["kind"]) => list.some((p) => p.kind === kind);

  for (const p of pa) {
    if (p.kind === "partnerWith" && namesMatch(p.name, b.name)) return true;
    if (p.kind === "partner") {
      if (pb.some((q) => q.kind === "partner" && (q.group ?? "") === (p.group ?? ""))) return true;
    }
  }
  for (const q of pb) {
    if (q.kind === "partnerWith" && namesMatch(q.name, a.name)) return true;
  }
  if (has(pa, "friendsForever") && has(pb, "friendsForever")) return true;
  if (has(pa, "chooseBackground") && has(pb, "background")) return true;
  if (has(pb, "chooseBackground") && has(pa, "background")) return true;
  if (has(pa, "doctorsCompanion") && has(pb, "timeLordDoctor")) return true;
  if (has(pb, "doctorsCompanion") && has(pa, "timeLordDoctor")) return true;
  return false;
}

function namesMatch(a: string, b: string) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return n(a) === n(b) || n(b.split(" // ")[0]) === n(a);
}

/** Union of all commanders' color identities, in WUBRG order. */
export function commanderIdentity(commanders: Card[]): Color[] {
  const set = new Set(commanders.flatMap((c) => c.colorIdentity));
  return COLORS.filter((c) => set.has(c));
}

export function isWithinIdentity(card: Card, identity: Color[]) {
  return card.colorIdentity.every((c) => identity.includes(c));
}

/**
 * How many copies of a card a deck may run: Infinity for basics and
 * "A deck can have any number of cards named…", N for "up to N cards named…".
 */
export function copyLimit(card: Card): number {
  if (isBasicLand(card)) return Infinity;
  const text = card.oracleText;
  if (/a deck can have any number of cards named/i.test(text)) return Infinity;
  const upTo = /a deck can have up to (\w+) cards named/i.exec(text);
  if (upTo) {
    const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return words[upTo[1].toLowerCase()] ?? (Number(upTo[1]) || 1);
  }
  return 1;
}

export function isCommanderLegal(card: Card) {
  return card.commanderLegality === "legal";
}

export function mainboardCount(deck: Pick<Deck, "cards">) {
  return deck.cards.filter((c) => (c.board ?? "main") === "main").reduce((n, c) => n + c.quantity, 0);
}

export function deckSize(deck: Pick<Deck, "cards" | "commanders">) {
  return mainboardCount(deck) + deck.commanders.length;
}

/** Validate a deck against Commander rules. */
export function validateDeck(deck: Deck): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const commanders = deck.commanders.map((c) => c.card);
  const main = deck.cards.filter((c) => (c.board ?? "main") === "main");

  // Commanders
  if (commanders.length === 0) {
    issues.push({ code: "no-commander", severity: "error", message: "Choose a commander for this deck." });
  } else if (commanders.length > MAX_COMMANDERS) {
    issues.push({
      code: "too-many-commanders",
      severity: "error",
      message: `A deck can have at most ${MAX_COMMANDERS} commanders.`,
      cards: commanders.map((c) => c.name),
    });
  } else {
    for (const c of commanders) {
      if (!canBeCommander(c)) {
        issues.push({
          code: "invalid-commander",
          severity: "error",
          message: `${c.name} can't be a commander (it must be a legendary creature or say it can be your commander).`,
          cards: [c.name],
        });
      }
    }
    if (commanders.length === 2 && !canPairCommanders(commanders[0], commanders[1])) {
      issues.push({
        code: "invalid-partners",
        severity: "error",
        message: `${commanders[0].name} and ${commanders[1].name} can't be commanders together. Both need a matching pairing ability such as Partner, Partner with, Friends forever, or Choose a Background.`,
        cards: commanders.map((c) => c.name),
      });
    }
    if (commanders.length === 1 && pairingAbilities(commanders[0]).some((p) => p.kind === "background")) {
      issues.push({
        code: "background-alone",
        severity: "error",
        message: `${commanders[0].name} is a Background and needs a commander with "Choose a Background".`,
        cards: [commanders[0].name],
      });
    }
  }

  // Deck size
  const size = deckSize(deck);
  if (size !== COMMANDER_DECK_SIZE) {
    const diff = size - COMMANDER_DECK_SIZE;
    issues.push({
      code: "deck-size",
      severity: "error",
      message:
        diff < 0
          ? `The deck has ${size} cards including commanders. Add ${-diff} more to reach ${COMMANDER_DECK_SIZE}.`
          : `The deck has ${size} cards including commanders. Remove ${diff} to reach ${COMMANDER_DECK_SIZE}.`,
    });
  }

  // Singleton
  const counts = new Map<string, { card: Card; qty: number }>();
  for (const dc of main) {
    const key = dc.card.oracleId;
    const prev = counts.get(key);
    counts.set(key, { card: dc.card, qty: (prev?.qty ?? 0) + dc.quantity });
  }
  for (const c of commanders) {
    const prev = counts.get(c.oracleId);
    if (prev) counts.set(c.oracleId, { card: c, qty: prev.qty + 1 });
  }
  const dupes = [...counts.values()].filter(({ card, qty }) => qty > copyLimit(card));
  if (dupes.length) {
    issues.push({
      code: "singleton",
      severity: "error",
      message: `Commander is singleton: ${dupes.map((d) => `${d.card.name} (×${d.qty})`).join(", ")} ${dupes.length === 1 ? "has" : "have"} too many copies.`,
      cards: dupes.map((d) => d.card.name),
    });
  }

  // Legality
  const illegal = [...commanders, ...main.map((d) => d.card)].filter((c) => !isCommanderLegal(c));
  if (illegal.length) {
    issues.push({
      code: "illegal",
      severity: "error",
      message: `Not legal in Commander: ${illegal.map((c) => `${c.name}${c.commanderLegality === "banned" ? " (banned)" : ""}`).join(", ")}.`,
      cards: illegal.map((c) => c.name),
    });
  }

  // Color identity
  if (commanders.length) {
    const identity = commanderIdentity(commanders);
    const outside = main.filter((d) => !isWithinIdentity(d.card, identity)).map((d) => d.card.name);
    if (outside.length) {
      issues.push({
        code: "color-identity",
        severity: "error",
        message: `${outside.length} card${outside.length === 1 ? " is" : "s are"} outside the commander's color identity: ${outside.join(", ")}.`,
        cards: outside,
      });
    }
  }

  if (deck.unresolved.length) {
    issues.push({
      code: "unresolved",
      severity: "warning",
      message: `${deck.unresolved.length} decklist line${deck.unresolved.length === 1 ? " wasn't" : "s weren't"} recognized and ${deck.unresolved.length === 1 ? "isn't" : "aren't"} counted.`,
      cards: deck.unresolved.map((u) => u.name),
    });
  }

  return issues;
}

/** Singleton warning for UI before changing a quantity. */
export function quantityWarning(card: Card, quantity: number): string | null {
  const limit = copyLimit(card);
  if (quantity > limit) {
    return limit === 1
      ? `Commander is singleton: only one copy of ${card.name} is allowed.`
      : `Only ${limit} copies of ${card.name} are allowed.`;
  }
  return null;
}
