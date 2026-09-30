import { normalizeCard } from "@/lib/scryfall/normalize";
import type { ScryfallCard } from "@/lib/scryfall/types";
import type { Card } from "@/lib/types";

let n = 0;
/** Build an ad-hoc card for engine tests (hybrid, Phyrexian, MDFC, etc.). */
export function makeCard(partial: Partial<ScryfallCard> & { name: string }): Card {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const cost = partial.mana_cost ?? "";
  const colors = partial.colors ?? [...new Set([...cost.matchAll(/\{([WUBRG])/g)].map((m) => m[1]))];
  return normalizeCard({
    object: "card",
    id,
    oracle_id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    layout: partial.card_faces ? "modal_dfc" : "normal",
    cmc: [...cost.matchAll(/\{([^}]+)\}/g)].reduce((s, [, sym]) => s + (/^\d+$/.test(sym) ? Number(sym) : sym === "X" ? 0 : 1), 0),
    type_line: "Creature",
    oracle_text: "",
    colors,
    color_identity: colors,
    legalities: { commander: "legal" },
    set: "tst",
    set_name: "Test",
    collector_number: String(n),
    rarity: "common",
    prices: { usd: "1.00" },
    scryfall_uri: "https://scryfall.com/",
    ...partial,
  });
}
