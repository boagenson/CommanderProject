import type { Card, CardFace, Color, Legality, ManaColor } from "@/lib/types";
import type { ScryfallCard } from "./types";

const COLOR_SET = new Set(["W", "U", "B", "R", "G"]);
const MANA_SET = new Set(["W", "U", "B", "R", "G", "C"]);

function toColors(values: string[] | undefined): Color[] {
  return (values ?? []).filter((c): c is Color => COLOR_SET.has(c));
}

function toNumber(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Convert a raw Scryfall card into the app's compact `Card` model. */
export function normalizeCard(raw: ScryfallCard): Card {
  const faces = raw.card_faces;
  const front = faces?.[0];
  const images = raw.image_uris ?? front?.image_uris ?? {};

  // Multi-face cards keep top-level oracle text empty; join the faces so
  // heuristics see every ability.
  const oracleText =
    raw.oracle_text ??
    (faces ?? []).map((f) => f.oracle_text ?? "").filter(Boolean).join("\n//\n");

  const colors = raw.colors ?? front?.colors;

  const normalizedFaces: CardFace[] | undefined = faces?.map((f) => ({
    name: f.name,
    manaCost: f.mana_cost ?? "",
    typeLine: f.type_line ?? "",
    oracleText: f.oracle_text ?? "",
    power: f.power,
    toughness: f.toughness,
    loyalty: f.loyalty,
    imageNormal: f.image_uris?.normal,
  }));

  return {
    id: raw.id,
    oracleId: raw.oracle_id ?? raw.id,
    name: raw.name,
    manaCost: raw.mana_cost ?? front?.mana_cost ?? "",
    cmc: raw.cmc ?? 0,
    typeLine: raw.type_line ?? front?.type_line ?? "",
    oracleText,
    power: raw.power ?? front?.power,
    toughness: raw.toughness ?? front?.toughness,
    loyalty: raw.loyalty ?? front?.loyalty,
    colors: toColors(colors),
    colorIdentity: toColors(raw.color_identity),
    keywords: raw.keywords ?? [],
    producedMana: (raw.produced_mana ?? []).filter((c): c is ManaColor => MANA_SET.has(c)),
    commanderLegality: (raw.legalities?.commander as Legality) ?? "not_legal",
    set: raw.set,
    setName: raw.set_name,
    collectorNumber: raw.collector_number,
    rarity: raw.rarity,
    prices: {
      usd: toNumber(raw.prices?.usd),
      usdFoil: toNumber(raw.prices?.usd_foil),
      eur: toNumber(raw.prices?.eur),
      tix: toNumber(raw.prices?.tix),
    },
    images: {
      small: images.small,
      normal: images.normal,
      large: images.large,
      artCrop: images.art_crop,
    },
    faces: normalizedFaces && normalizedFaces.length > 1 ? normalizedFaces : undefined,
    scryfallUri: raw.scryfall_uri,
    layout: raw.layout,
    fetchedAt: Date.now(),
  };
}
