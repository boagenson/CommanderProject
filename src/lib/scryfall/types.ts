/** Subset of Scryfall's card object that Commander Workshop reads. */
export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  image_uris?: ScryfallImageUris;
}

export interface ScryfallCard {
  object: "card";
  id: string;
  oracle_id?: string;
  name: string;
  layout: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity: string[];
  keywords?: string[];
  produced_mana?: string[];
  legalities: Record<string, string>;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  prices?: Record<string, string | null>;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  scryfall_uri: string;
}

export interface ScryfallList<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  next_page?: string;
  total_cards?: number;
  not_found?: ScryfallIdentifier[];
  warnings?: string[];
}

export interface ScryfallError {
  object: "error";
  status: number;
  code: string;
  details: string;
}

export interface ScryfallCatalog {
  object: "catalog";
  data: string[];
}

export interface ScryfallSet {
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  icon_svg_uri?: string;
}

export type ScryfallIdentifier =
  | { id: string }
  | { name: string }
  | { name: string; set: string }
  | { set: string; collector_number: string };
