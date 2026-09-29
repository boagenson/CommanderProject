import type { Color } from "@/lib/types";

export interface CardSearchFilters {
  name?: string;
  colors?: Color[];
  colorMode?: "including" | "exactly" | "atMost";
  colorless?: boolean;
  /** Restrict to cards whose color identity fits within these colors. */
  identity?: Color[];
  mvMin?: number;
  mvMax?: number;
  type?: string;
  text?: string;
  set?: string;
  rarity?: "" | "common" | "uncommon" | "rare" | "mythic";
  commanderLegal?: boolean;
  priceMin?: number;
  priceMax?: number;
  keyword?: string;
}

const quote = (s: string) => (/[\s:"()]/.test(s) ? `"${s.replace(/"/g, "")}"` : s);

/** Build a Scryfall search string from structured filters. */
export function buildScryfallQuery(f: CardSearchFilters): string {
  const parts: string[] = [];
  if (f.name?.trim()) parts.push(`name:${quote(f.name.trim())}`);

  if (f.colorless) {
    parts.push("c:c");
  } else if (f.colors?.length) {
    const cs = f.colors.join("").toLowerCase();
    const op = f.colorMode === "exactly" ? "=" : f.colorMode === "atMost" ? "<=" : ">=";
    parts.push(`c${op}${cs}`);
  }

  if (f.identity) {
    parts.push(f.identity.length ? `id<=${f.identity.join("").toLowerCase()}` : "id:c");
  }

  if (f.mvMin != null && Number.isFinite(f.mvMin)) parts.push(`mv>=${f.mvMin}`);
  if (f.mvMax != null && Number.isFinite(f.mvMax)) parts.push(`mv<=${f.mvMax}`);

  if (f.type?.trim()) {
    for (const t of f.type.trim().split(/\s+/)) parts.push(`t:${quote(t)}`);
  }
  if (f.text?.trim()) parts.push(`o:${quote(f.text.trim())}`);
  if (f.set?.trim()) parts.push(`s:${f.set.trim().toLowerCase()}`);
  if (f.rarity) parts.push(`r:${f.rarity}`);
  if (f.commanderLegal) parts.push("f:commander");
  if (f.priceMin != null && Number.isFinite(f.priceMin)) parts.push(`usd>=${f.priceMin}`);
  if (f.priceMax != null && Number.isFinite(f.priceMax)) parts.push(`usd<=${f.priceMax}`);
  if (f.keyword?.trim()) parts.push(`keyword:${quote(f.keyword.trim())}`);

  return parts.join(" ");
}
