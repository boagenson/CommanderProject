/**
 * Recorded card data for offline tests, shaped like Scryfall API responses.
 * Oracle text is transcribed for the cards the sample deck and upgrade tests
 * use; prices are illustrative. The app itself always uses live Scryfall data.
 */
import type { ScryfallCard } from "../../src/lib/scryfall/types";

type Extra = {
  pt?: string;
  kw?: string[];
  produced?: string[];
  ci?: string;
  set?: string;
  cn?: string;
  rarity?: string;
  banned?: boolean;
  colors?: string;
};
type Row = [name: string, cost: string, type: string, text: string, usd: number | null, extra?: Extra];

const ROWS: Row[] = [
  // Commanders
  ["Frodo, Adventurous Hobbit", "{W}{B}", "Legendary Creature — Halfling Scout", "Partner with Sam, Loyal Attendant (When this creature enters, target player may put Sam into their hand from their library, then shuffle.)\nVigilance\nWhenever Frodo attacks, if you gained 3 or more life this turn, the Ring tempts you. Then if Frodo is your Ring-bearer and the Ring has tempted you two or more times this game, draw a card.", 0.6, { pt: "1/3", kw: ["Partner with", "Vigilance"], set: "ltc", cn: "2", rarity: "mythic" }],
  ["Sam, Loyal Attendant", "{1}{G}", "Legendary Creature — Halfling Peasant", "Partner with Frodo, Adventurous Hobbit (When this creature enters, target player may put Frodo into their hand from their library, then shuffle.)\nAt the beginning of combat on your turn, create a Food token.\nActivated abilities of Foods you control cost {1} less to activate.", 0.8, { pt: "2/4", kw: ["Partner with"], set: "ltc", cn: "90", rarity: "mythic" }],
  // Ramp
  ["Sol Ring", "{1}", "Artifact", "{T}: Add {C}{C}.", 1.5, { produced: ["C"] }],
  ["Arcane Signet", "{2}", "Artifact", "{T}: Add one mana of any color in your commander's color identity.", 0.5, { produced: ["W", "U", "B", "R", "G"] }],
  ["Commander's Sphere", "{3}", "Artifact", "{T}: Add one mana of any color in your commander's color identity.\nSacrifice Commander's Sphere: Draw a card.", 0.3, { produced: ["W", "U", "B", "R", "G"] }],
  ["Birds of Paradise", "{G}", "Creature — Bird", "Flying\n{T}: Add one mana of any color.", 8, { pt: "0/1", kw: ["Flying"], produced: ["W", "U", "B", "R", "G"] }],
  ["Gilded Goose", "{G}", "Creature — Bird", "Flying\nWhen Gilded Goose enters, create a Food token.\n{1}{G}, {T}: Create a Food token.\n{T}, Sacrifice a Food: Add one mana of any color.", 1.2, { pt: "0/2", kw: ["Flying"], produced: ["W", "U", "B", "R", "G"] }],
  ["Cultivate", "{2}{G}", "Sorcery", "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.", 0.3],
  ["Kodama's Reach", "{2}{G}", "Sorcery — Arcane", "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.", 0.4],
  ["Farseek", "{1}{G}", "Sorcery", "Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.", 0.5],
  ["Nature's Lore", "{1}{G}", "Sorcery", "Search your library for a Forest card, put that card onto the battlefield, then shuffle.", 0.5],
  ["Rampant Growth", "{1}{G}", "Sorcery", "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", 0.3],
  ["Wood Elves", "{2}{G}", "Creature — Elf Scout", "When Wood Elves enters, search your library for a Forest card, put that card onto the battlefield, then shuffle.", 0.3, { pt: "1/1" }],
  // Food / artifact tokens
  ["Academy Manufactor", "{3}", "Artifact Creature — Assembly-Worker", "If you would create a Clue, Food, or Treasure token, instead create one of each.", 9, { pt: "1/3" }],
  ["Tireless Provisioner", "{2}{G}", "Creature — Elf Scout", "Landfall — Whenever a land you control enters, create a Food token or a Treasure token.", 1.5, { pt: "3/2", kw: ["Landfall"], produced: ["W", "U", "B", "R", "G"] }],
  ["Peregrin Took", "{2}{G}", "Legendary Creature — Halfling Citizen", "If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead.\nSacrifice three Foods: Draw a card.", 2, { pt: "2/3" }],
  ["Bake into a Pie", "{2}{B}{B}", "Instant", "Destroy target creature. Create a Food token.", 0.3],
  ["Savvy Hunter", "{1}{B}{G}", "Creature — Human Warrior", "Whenever Savvy Hunter attacks or blocks, create a Food token.\nSacrifice two Foods: Draw a card.", 0.3, { pt: "3/3" }],
  ["Trail of Crumbs", "{1}{G}", "Enchantment", "When Trail of Crumbs enters, create a Food token.\nWhenever you sacrifice a Food, you may pay {1}. If you do, look at the top two cards of your library. You may reveal a permanent card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", 0.8],
  ["Witch's Oven", "{1}", "Artifact", "{T}, Sacrifice a creature: Create a Food token. If the sacrificed creature's toughness was 4 or greater, create two Food tokens instead.", 0.6],
  ["Gyome, Master Chef", "{2}{B}{G}", "Legendary Creature — Troll Warlock", "Trample\nAt the beginning of your end step, create a number of Food tokens equal to the number of nontoken creatures you had enter the battlefield under your control this turn.\n{1}, Sacrifice a Food: Target creature gains indestructible until end of turn. Tap it.", 0.5, { pt: "5/3", kw: ["Trample"] }],
  ["Heaped Harvest", "{2}{G}", "Artifact — Food", "When Heaped Harvest enters and when you sacrifice it, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\n{2}, {T}, Sacrifice Heaped Harvest: You gain 3 life.", 0.3],
  ["Farmer Cotton", "{X}{G}{W}", "Legendary Creature — Halfling Peasant", "When Farmer Cotton enters, create X 1/1 white Halfling creature tokens and X Food tokens.", 0.5, { pt: "1/1" }],
  ["Rosie Cotton of South Lane", "{2}{W}", "Legendary Creature — Halfling Peasant", "When Rosie Cotton of South Lane enters, create a Food token.\nWhenever you create a token, put a +1/+1 counter on target creature you control other than a token.", 0.8, { pt: "1/1" }],
  ["Samwise Gamgee", "{G}{W}", "Legendary Creature — Halfling Peasant", "Whenever another nontoken creature you control enters, create a Food token.\nSacrifice three Foods: Return target historic card from your graveyard to your hand.", 0.5, { pt: "2/2" }],
  // Lifegain
  ["Soul Warden", "{W}", "Creature — Human Cleric", "Whenever another creature enters, you gain 1 life.", 0.3, { pt: "1/1" }],
  ["Ajani's Pridemate", "{1}{W}", "Creature — Cat Soldier", "Whenever you gain life, put a +1/+1 counter on Ajani's Pridemate.", 0.3, { pt: "2/2" }],
  ["Heliod, Sun-Crowned", "{2}{W}", "Legendary Enchantment Creature — God", "Indestructible\nAs long as your devotion to white is less than five, Heliod isn't a creature.\nWhenever you gain life, put a +1/+1 counter on target creature or enchantment you control.\n{1}{W}: Another target creature gains lifelink until end of turn.", 5, { pt: "5/5", kw: ["Indestructible"] }],
  ["Well of Lost Dreams", "{4}", "Artifact", "Whenever you gain life, you may pay {X}, where X is less than or equal to the amount of life you gained. If you do, draw X cards.", 1],
  ["Archangel of Thune", "{3}{W}{W}", "Creature — Angel", "Flying\nLifelink\nWhenever you gain life, put a +1/+1 counter on each creature you control.", 6, { pt: "3/4", kw: ["Flying", "Lifelink"] }],
  ["Vito, Thorn of the Dusk Rose", "{2}{B}", "Legendary Creature — Vampire Cleric", "Whenever you gain life, target opponent loses that much life.\n{3}{B}{B}: Creatures you control gain lifelink until end of turn.", 3, { pt: "1/3" }],
  ["Sanguine Bond", "{3}{B}{B}", "Enchantment", "Whenever you gain life, target opponent loses that much life.", 4],
  ["Exquisite Blood", "{4}{B}", "Enchantment", "Whenever an opponent loses life, you gain that much life.", 3.5],
  ["Dina, Soul Steeper", "{B}{G}", "Legendary Creature — Dryad Druid", "Whenever you gain life, each opponent loses 1 life.\n{1}, Sacrifice another creature: Dina gets +X/+0 until end of turn, where X is the sacrificed creature's power.", 0.4, { pt: "1/3" }],
  // Sacrifice
  ["Viscera Seer", "{B}", "Creature — Vampire Wizard", "Sacrifice a creature: Scry 1.", 0.3, { pt: "1/1" }],
  ["Blood Artist", "{1}{B}", "Creature — Vampire", "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.", 1, { pt: "0/1" }],
  ["Zulaport Cutthroat", "{1}{B}", "Creature — Human Rogue Ally", "Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life and you gain 1 life.", 0.4, { pt: "1/1" }],
  ["Ashnod's Altar", "{3}", "Artifact", "Sacrifice a creature: Add {C}{C}.", 6, { produced: ["C"] }],
  ["Pitiless Plunderer", "{3}{B}", "Creature — Human Pirate", "Whenever another creature you control dies, create a Treasure token.", 3, { pt: "1/4" }],
  // Treasure / clues
  ["Tireless Tracker", "{2}{G}", "Creature — Human Scout", "Landfall — Whenever a land you control enters, investigate.\nWhenever you sacrifice a Clue, put a +1/+1 counter on Tireless Tracker.", 2.5, { pt: "3/2", kw: ["Landfall", "Investigate"] }],
  ["Deadly Dispute", "{1}{B}", "Instant", "As an additional cost to cast this spell, sacrifice an artifact or creature.\nDraw two cards and create a Treasure token.", 1],
  ["Smothering Tithe", "{3}{W}", "Enchantment", "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.", 22],
  // Draw
  ["Phyrexian Arena", "{1}{B}{B}", "Enchantment", "At the beginning of your upkeep, you draw a card and you lose 1 life.", 3],
  ["Night's Whisper", "{1}{B}", "Sorcery", "You draw two cards and you lose 2 life.", 0.5],
  ["Harmonize", "{2}{G}{G}", "Sorcery", "Draw three cards.", 0.5],
  ["Skullclamp", "{1}", "Artifact — Equipment", "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}", 3],
  // Removal
  ["Swords to Plowshares", "{W}", "Instant", "Exile target creature. Its controller gains life equal to its power.", 2],
  ["Path to Exile", "{W}", "Instant", "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.", 3],
  ["Beast Within", "{2}{G}", "Instant", "Destroy target permanent. Its controller creates a 3/3 green Beast creature token.", 1],
  ["Assassin's Trophy", "{B}{G}", "Instant", "Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.", 1.5],
  ["Anguished Unmaking", "{1}{W}{B}", "Instant", "Exile target nonland permanent. You lose 3 life.", 1.5],
  ["Generous Gift", "{2}{W}", "Instant", "Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.", 1],
  ["Mortify", "{1}{W}{B}", "Instant", "Destroy target creature or enchantment.", 0.4],
  ["Wrath of God", "{2}{W}{W}", "Sorcery", "Destroy all creatures. They can't be regenerated.", 5],
  ["Damnation", "{2}{B}{B}", "Sorcery", "Destroy all creatures. They can't be regenerated.", 25],
  // Protection
  ["Heroic Intervention", "{1}{G}", "Instant", "Permanents you control gain hexproof and indestructible until end of turn.", 6],
  ["Lightning Greaves", "{2}", "Artifact — Equipment", "Equipped creature has haste and shroud.\nWhenever a creature enters under your control, you may attach Lightning Greaves to it.\nEquip {0}", 2.5],
  ["Teferi's Protection", "{2}{W}", "Instant", "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out.\nExile Teferi's Protection.", 20],
  // Recursion / tutors / tokens
  ["Eternal Witness", "{1}{G}{G}", "Creature — Human Shaman", "When Eternal Witness enters, return target card from your graveyard to your hand.", 1.5, { pt: "2/1" }],
  ["Sun Titan", "{4}{W}{W}", "Creature — Giant", "Vigilance\nWhenever Sun Titan enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.", 2, { pt: "6/6", kw: ["Vigilance"] }],
  ["Demonic Tutor", "{1}{B}", "Sorcery", "Search your library for a card, put that card into your hand, then shuffle.", 30],
  ["Worldly Tutor", "{G}", "Instant", "Search your library for a creature card, reveal it, then shuffle and put that card on top.", 12],
  ["Anointed Procession", "{3}{W}", "Enchantment", "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.", 15],
  ["Parallel Lives", "{3}{G}", "Enchantment", "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.", 18],
  // Lands
  ["Command Tower", "", "Land", "{T}: Add one mana of any color in your commander's color identity.", 0.3, { produced: ["W", "U", "B", "R", "G"] }],
  ["Exotic Orchard", "", "Land", "{T}: Add one mana of any color that a land an opponent controls could produce.", 0.4, { produced: ["W", "U", "B", "R", "G"] }],
  ["Sandsteppe Citadel", "", "Land", "Sandsteppe Citadel enters tapped.\n{T}: Add {W}, {B}, or {G}.", 0.3, { produced: ["W", "B", "G"] }],
  ["Scoured Barrens", "", "Land", "Scoured Barrens enters tapped.\nWhen Scoured Barrens enters, you gain 1 life.\n{T}: Add {W} or {B}.", 0.1, { produced: ["W", "B"] }],
  ["Jungle Hollow", "", "Land", "Jungle Hollow enters tapped.\nWhen Jungle Hollow enters, you gain 1 life.\n{T}: Add {B} or {G}.", 0.1, { produced: ["B", "G"] }],
  ["Blossoming Sands", "", "Land", "Blossoming Sands enters tapped.\nWhen Blossoming Sands enters, you gain 1 life.\n{T}: Add {G} or {W}.", 0.1, { produced: ["G", "W"] }],
  ["Evolving Wilds", "", "Land", "{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", 0.1],
  ["Terramorphic Expanse", "", "Land", "{T}, Sacrifice Terramorphic Expanse: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", 0.1],
  ["Temple Garden", "", "Land — Forest Plains", "({T}: Add {G} or {W}.)\nAs Temple Garden enters, you may pay 2 life. If you don't, it enters tapped.", 12, { produced: ["G", "W"] }],
  ["Godless Shrine", "", "Land — Plains Swamp", "({T}: Add {W} or {B}.)\nAs Godless Shrine enters, you may pay 2 life. If you don't, it enters tapped.", 12, { produced: ["W", "B"] }],
  ["Overgrown Tomb", "", "Land — Swamp Forest", "({T}: Add {B} or {G}.)\nAs Overgrown Tomb enters, you may pay 2 life. If you don't, it enters tapped.", 14, { produced: ["B", "G"] }],
  ["Isolated Chapel", "", "Land", "Isolated Chapel enters tapped unless you control a Plains or a Swamp.\n{T}: Add {W} or {B}.", 4, { produced: ["W", "B"] }],
  ["Woodland Cemetery", "", "Land", "Woodland Cemetery enters tapped unless you control a Swamp or a Forest.\n{T}: Add {B} or {G}.", 4, { produced: ["B", "G"] }],
  ["Sunpetal Grove", "", "Land", "Sunpetal Grove enters tapped unless you control a Forest or a Plains.\n{T}: Add {G} or {W}.", 3, { produced: ["G", "W"] }],
  ["Plains", "", "Basic Land — Plains", "({T}: Add {W}.)", 0.1, { produced: ["W"] }],
  ["Swamp", "", "Basic Land — Swamp", "({T}: Add {B}.)", 0.1, { produced: ["B"] }],
  ["Forest", "", "Basic Land — Forest", "({T}: Add {G}.)", 0.1, { produced: ["G"] }],

  // Upgrade candidates (not in the sample deck)
  ["Mirkwood Bats", "{3}{B}", "Creature — Bat", "Flying\nWhenever you create or sacrifice a token, each opponent loses 1 life.", 0.5, { pt: "2/3", kw: ["Flying"] }],
  ["Bastion of Remembrance", "{2}{B}", "Enchantment", "When Bastion of Remembrance enters, create a 1/1 white Human Soldier creature token.\nWhenever a creature you control dies, each opponent loses 1 life and you gain 1 life.", 0.8],
  ["Cruel Celebrant", "{W}{B}", "Creature — Vampire", "Whenever Cruel Celebrant or another creature or planeswalker you control dies, each opponent loses 1 life and you gain 1 life.", 0.4, { pt: "1/2" }],
  ["Fellwar Stone", "{2}", "Artifact", "{T}: Add one mana of any color that a land an opponent controls could produce.", 0.5, { produced: ["W", "U", "B", "R", "G"] }],
  ["Three Visits", "{1}{G}", "Sorcery", "Search your library for a Forest card, put that card onto the battlefield, then shuffle.", 1],
  ["Village Rites", "{B}", "Instant", "As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.", 0.3],
  ["Bartered Cow", "{3}{W}", "Creature — Ox", "When Bartered Cow dies or when you discard it, create a Food token.", 0.2, { pt: "3/3" }],
  ["Feed the Swarm", "{1}{B}", "Sorcery", "Choose one —\n• Destroy target creature or enchantment an opponent controls.\n• Destroy target creature an opponent controls.\nYou lose life equal to that permanent's mana value.", 0.3],
  ["Toxic Deluge", "{2}{B}", "Sorcery", "As an additional cost to cast this spell, pay X life.\nAll creatures get -X/-X until end of turn.", 14],
  ["Lotho, Corrupt Shirriff", "{W}{B}", "Legendary Creature — Halfling Rogue", "Whenever an opponent casts their second spell each turn, you create a Treasure token and lose 1 life.", 3, { pt: "2/2" }],
  ["The Great Henge", "{7}{G}{G}", "Legendary Artifact", "This spell costs {X} less to cast, where X is the greatest power among creatures you control.\n{T}: Add {G}{G}. You gain 2 life.\nWhenever a nontoken creature you control enters, put a +1/+1 counter on it and draw a card.", 45, { produced: ["G"] }],
  ["Esper Sentinel", "{W}", "Artifact Creature — Human Soldier", "Whenever an opponent casts their first noncreature spell each turn, draw a card unless that player pays {X}, where X is Esper Sentinel's power.", 20, { pt: "1/1" }],
  ["Caves of Koilos", "", "Land", "{T}: Add {C}.\n{T}: Add {W} or {B}. Caves of Koilos deals 1 damage to you.", 0.5, { produced: ["C", "W", "B"] }],
  ["Llanowar Wastes", "", "Land", "{T}: Add {C}.\n{T}: Add {B} or {G}. Llanowar Wastes deals 1 damage to you.", 0.5, { produced: ["C", "B", "G"] }],
  ["Grim Lavamancer", "{R}", "Creature — Human Wizard", "{R}, {T}, Exile two cards from your graveyard: Grim Lavamancer deals 2 damage to any target.", 2, { pt: "1/1" }],
  ["Mana Crypt", "{0}", "Artifact", "At the beginning of your upkeep, flip a coin. If you lose the flip, Mana Crypt deals 3 damage to you.\n{T}: Add {C}{C}.", 150, { produced: ["C"], banned: true }],
];

const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
};
const uuid = (seed: string) => {
  const h = (hash(seed) + hash(seed + "a") + hash(seed + "b") + hash(seed + "c")).slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

function cmcOf(cost: string) {
  let n = 0;
  for (const [, s] of cost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(s)) n += Number(s);
    else if (s !== "X") n += 1;
  }
  return n;
}

const ORDER = "WUBRG";
const sortColors = (cs: Iterable<string>) => [...new Set(cs)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

function toScryfall([name, cost, type, text, usd, x = {}]: Row): ScryfallCard {
  const colors = x.colors ? x.colors.split("") : sortColors([...cost.matchAll(/\{([WUBRG])(?:\/P)?\}/g)].map((m) => m[1]));
  const textSymbols = [...text.replace(/\([^)]*\)/g, "").matchAll(/\{([WUBRG])\}/g)].map((m) => m[1]);
  const landColors = /\bLand\b/.test(type) ? (x.produced ?? []).filter((c) => c !== "C" && !/any color/.test(text)) : [];
  const ci = x.ci ? x.ci.split("") : sortColors([...colors, ...textSymbols, ...landColors]);
  const [power, toughness] = x.pt?.split("/") ?? [];
  const id = uuid(name);
  const img = (size: string) => `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
  return {
    object: "card",
    id,
    oracle_id: uuid(`oracle:${name}`),
    name,
    layout: "normal",
    mana_cost: cost,
    cmc: cmcOf(cost),
    type_line: type,
    oracle_text: text,
    power,
    toughness,
    colors,
    color_identity: ci,
    keywords: x.kw ?? [],
    produced_mana: x.produced,
    legalities: { commander: x.banned ? "banned" : "legal" },
    set: x.set ?? "cmm",
    set_name: x.set === "ltc" ? "Tales of Middle-earth Commander" : "Commander Masters",
    collector_number: x.cn ?? String(parseInt(hash(name).slice(0, 4), 16) % 400),
    rarity: x.rarity ?? "rare",
    prices: { usd: usd == null ? null : usd.toFixed(2), usd_foil: null, eur: null, tix: null },
    image_uris: { small: img("small"), normal: img("normal"), large: img("large"), art_crop: img("art_crop") },
    scryfall_uri: `https://scryfall.com/card/${x.set ?? "cmm"}/${encodeURIComponent(name.toLowerCase())}`,
  };
}

export const FIXTURE_CARDS: ScryfallCard[] = ROWS.map(toScryfall);
export const FIXTURE_BY_NAME = new Map(FIXTURE_CARDS.map((c) => [c.name.toLowerCase(), c]));
export const CANDIDATE_NAMES = ROWS.slice(ROWS.findIndex((r) => r[0] === "Mirkwood Bats")).map((r) => r[0]);
