/**
 * Decklist text parser. Pure and synchronous: it understands the common
 * export formats (plain, MTGA/Moxfield with set codes, Archidekt tags) and
 * leaves card resolution to `resolve.ts`.
 *
 * Supported line shapes:
 *   1 Sol Ring
 *   1x Sol Ring
 *   Sol Ring
 *   1 Frodo, Adventurous Hobbit (LTC) 2
 *   1 Sol Ring (C21) 263 *F*
 *   1 Sol Ring [C21]
 *   1x Sol Ring (cmr) 472 [Ramp] ^Have^
 *   1 Frodo, Adventurous Hobbit *CMDR*
 * Section headers: "Commander", "Deck", "Mainboard", "Sideboard", "Maybeboard" (with
 * optional "//", trailing ":" or counts like "Commander (2)").
 */

export type ParsedSection = "commander" | "main" | "maybe";

export interface ParsedEntry {
  lineNumber: number;
  line: string;
  quantity: number;
  name: string;
  set?: string;
  collectorNumber?: string;
  section: ParsedSection;
}

export interface ParseError {
  lineNumber: number;
  line: string;
  message: string;
}

export interface ParsedDecklist {
  entries: ParsedEntry[];
  errors: ParseError[];
}

const SECTION_HEADERS: Record<string, ParsedSection | "ignore"> = {
  commander: "commander",
  commanders: "commander",
  "command zone": "commander",
  deck: "main",
  main: "main",
  mainboard: "main",
  "main deck": "main",
  library: "main",
  sideboard: "maybe",
  maybeboard: "maybe",
  maybe: "maybe",
  considering: "maybe",
  companion: "maybe",
  tokens: "maybe",
  about: "ignore",
};

const TYPE_HEADERS = new Set([
  "creature", "creatures", "artifact", "artifacts", "enchantment", "enchantments",
  "instant", "instants", "sorcery", "sorceries", "planeswalker", "planeswalkers",
  "land", "lands", "battle", "battles", "other", "ramp", "draw", "removal",
]);

function headerOf(line: string): ParsedSection | "ignore" | "type" | null {
  const cleaned = line
    .replace(/^\/\/\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/:\s*\d*\s*$/, "")
    .trim()
    .toLowerCase();
  if (cleaned in SECTION_HEADERS) return SECTION_HEADERS[cleaned];
  if (TYPE_HEADERS.has(cleaned)) return "type";
  return null;
}

const LINE_RE =
  /^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+[([]([A-Za-z0-9]{2,6})[)\]](?:\s+([A-Za-z0-9★\-]+))?)?$/i;

/** Strip Archidekt/Moxfield decorations: tags, foil markers, category labels. */
function stripDecorations(rest: string) {
  let commander = false;
  let s = rest;
  if (/\*CMDR\*/i.test(s)) commander = true;
  s = s
    .replace(/\*[A-Z]+\*/gi, " ") // *F*, *E*, *CMDR*
    .replace(/\^[^^]*\^/g, " ") // ^Have,#37d67a^
    .replace(/\s\[(?![A-Za-z0-9]{2,6}\])[^\]]*\]/g, " ") // [Ramp, Draw] tags but not [C21] set codes
    .replace(/\s+#\S.*$/, " ") // "#tag" suffixes
    .replace(/\s+/g, " ")
    .trim();
  // With a "(SET)" code present, any remaining [..] is a category tag.
  if (/\([A-Za-z0-9]{2,6}\)/.test(s)) s = s.replace(/\s\[[^\]]*\]/g, "").trim();
  return { text: s, commander };
}

export function parseDecklist(text: string): ParsedDecklist {
  const entries: ParsedEntry[] = [];
  const errors: ParseError[] = [];
  let section: ParsedSection = "main";

  const lines = text.split(/\r?\n/);
  lines.forEach((original, i) => {
    const lineNumber = i + 1;
    const line = original.trim();
    if (!line) return;

    const header = headerOf(line);
    if (header) {
      if (header !== "ignore" && header !== "type") section = header;
      return;
    }
    if (line.startsWith("//") || line.startsWith("#")) return;
    // MTGA metadata lines ("Name My Deck").
    if (/^name\s/i.test(line) && section === "main" && entries.length === 0) return;

    const { text: cleaned, commander } = stripDecorations(line);
    const m = LINE_RE.exec(cleaned);
    if (!m || !m[2]) {
      errors.push({ lineNumber, line: original, message: "Couldn't read this line." });
      return;
    }
    const quantity = m[1] ? Number.parseInt(m[1], 10) : 1;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 250) {
      errors.push({ lineNumber, line: original, message: "Quantity must be between 1 and 250." });
      return;
    }
    const name = m[2].replace(/\s+/g, " ").trim();
    if (name.length < 2 || /^\d+$/.test(name)) {
      errors.push({ lineNumber, line: original, message: "Missing card name." });
      return;
    }

    entries.push({
      lineNumber,
      line: original,
      quantity,
      name,
      set: m[3]?.toLowerCase(),
      collectorNumber: m[4],
      section: commander ? "commander" : section,
    });
  });

  return { entries, errors };
}

/** Front face of "A // B" names, which Scryfall collection lookups accept. */
export function frontFaceName(name: string) {
  return name.split(/\s+\/\/\s+/)[0].trim();
}
