/**
 * Built-in combo definitions. This is deliberately a data file: combos are
 * looked up by card name, never inferred from rules text, so the app never
 * invents combos that don't exist. External sources (for example a
 * Commander Spellbook export) can be plugged in through `ComboSource`
 * in `engine.ts`; a definition's `source` says where it came from.
 *
 * `type`:
 *   infinite — loops without a natural stopping point (wins or locks the game)
 *   engine   — repeatable value that does not loop infinitely on its own
 *   synergy  — a strong two-card relationship worth naming
 */
import type { ComboDefinition } from "@/lib/types";

export const BUILT_IN_COMBOS: ComboDefinition[] = [
  // --- Infinite -----------------------------------------------------------
  {
    id: "sanguine-exquisite",
    name: "Sanguine Bond + Exquisite Blood",
    required: ["Sanguine Bond", "Exquisite Blood"],
    result: "Infinite life drain: each opponent loses all their life.",
    requirements: ["Both enchantments on the battlefield", "Any single instance of life gain or an opponent losing life"],
    description: "Gaining life makes an opponent lose that much life (Sanguine Bond), which gains you that much life again (Exquisite Blood). The loop only stops when opponents are dead.",
    type: "infinite",
  },
  {
    id: "vito-exquisite",
    name: "Vito, Thorn of the Dusk Rose + Exquisite Blood",
    required: ["Vito, Thorn of the Dusk Rose", "Exquisite Blood"],
    result: "Infinite life drain against the targeted opponent (repeatable for each opponent).",
    requirements: ["Vito on the battlefield with Exquisite Blood", "Any life gain to start"],
    description: "Vito converts your life gain into life loss for an opponent; Exquisite Blood converts that loss back into life gain, so the two trigger each other endlessly.",
    type: "infinite",
  },
  {
    id: "heliod-ballista",
    name: "Heliod, Sun-Crowned + Walking Ballista",
    required: ["Heliod, Sun-Crowned", "Walking Ballista"],
    result: "Infinite damage to any targets.",
    requirements: ["Walking Ballista with at least two counters and lifelink (Heliod can grant it)"],
    description: "Ballista pings, lifelink gains life, Heliod puts a +1/+1 counter back on Ballista, and the loop repeats.",
    type: "infinite",
  },
  {
    id: "mikaeus-triskelion",
    name: "Mikaeus, the Unhallowed + Triskelion",
    required: ["Mikaeus, the Unhallowed", "Triskelion"],
    result: "Infinite damage to any targets.",
    description: "Triskelion shoots itself with its last counter, dies, returns with undying and a +1/+1 counter plus Mikaeus's bonus, and repeats.",
    type: "infinite",
  },
  {
    id: "kiki-conscripts",
    name: "Kiki-Jiki, Mirror Breaker + Zealous Conscripts",
    required: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"],
    result: "Infinite hasty attackers.",
    description: "Kiki-Jiki copies Conscripts, the copy untaps Kiki-Jiki, and the loop makes any number of attackers with haste.",
    type: "infinite",
  },
  {
    id: "twin-exarch",
    name: "Splinter Twin + Deceiver Exarch",
    required: ["Splinter Twin", "Deceiver Exarch"],
    result: "Infinite hasty attackers.",
    description: "Each copy untaps the enchanted Exarch, which makes another copy.",
    type: "infinite",
  },
  {
    id: "thoracle-consult",
    name: "Thassa's Oracle + Demonic Consultation",
    required: ["Thassa's Oracle", "Demonic Consultation"],
    result: "Win the game immediately.",
    description: "Exile your library with Consultation, then Thassa's Oracle's trigger wins with an empty library.",
    type: "infinite",
  },
  {
    id: "thoracle-pact",
    name: "Thassa's Oracle + Tainted Pact",
    required: ["Thassa's Oracle", "Tainted Pact"],
    result: "Win the game immediately.",
    requirements: ["Few or no duplicate card names in the library (basic lands count)"],
    description: "Tainted Pact exiles the library, then Thassa's Oracle wins on an empty library.",
    type: "infinite",
  },
  {
    id: "scepter-reversal",
    name: "Isochron Scepter + Dramatic Reversal",
    required: ["Isochron Scepter", "Dramatic Reversal"],
    result: "Infinite mana (and infinite untaps of nonland permanents).",
    requirements: ["Mana rocks or dorks that produce at least three mana"],
    description: "Copy Dramatic Reversal each turn cycle for {2}, untapping everything including the mana rocks that paid for it.",
    type: "infinite",
  },
  {
    id: "food-chain-scourge",
    name: "Food Chain + Eternal Scourge",
    required: ["Food Chain", "Eternal Scourge"],
    optional: ["Misthollow Griffin", "Squee, the Immortal"],
    result: "Infinite mana for casting creature spells.",
    description: "Exile Scourge to Food Chain for one more mana than it costs, recast it from exile, repeat.",
    type: "infinite",
  },
  {
    id: "altar-deathmantle-titan",
    name: "Ashnod's Altar + Nim Deathmantle + Grave Titan",
    required: ["Ashnod's Altar", "Nim Deathmantle", "Grave Titan"],
    result: "Infinite Zombie tokens and infinite enters-the-battlefield triggers.",
    description: "Sacrifice Grave Titan and a Zombie for four mana, pay {4} to return Titan with Deathmantle, make two more Zombies, repeat.",
    type: "infinite",
  },
  {
    id: "peregrin-took-manufactor-loop",
    name: "Academy Manufactor + Peregrin Took + Sacrifice outlet draw",
    required: ["Academy Manufactor", "Peregrin Took"],
    optional: ["Trail of Crumbs", "Gilded Goose", "Savvy Hunter"],
    result: "Every token creation becomes a Food, Treasure and Clue plus an extra Food (and its Treasure and Clue).",
    description: "Peregrin Took adds a Food to every batch of tokens, and Academy Manufactor turns each Food into a Food, a Treasure and a Clue. A single token maker now produces six artifacts.",
    type: "engine",
  },

  // --- Engines ------------------------------------------------------------
  {
    id: "oven-familiar",
    name: "Witch's Oven + Cauldron Familiar",
    required: ["Witch's Oven", "Cauldron Familiar"],
    result: "Drain each opponent for 1 every turn while making Food.",
    description: "Sacrifice the Cat to the Oven for a Food, sacrifice the Food to return the Cat, and drain each opponent on every re-entry.",
    type: "engine",
  },
  {
    id: "skullclamp-tokens",
    name: "Skullclamp + Bitterblossom",
    required: ["Skullclamp", "Bitterblossom"],
    result: "Draw two cards every turn for {1}.",
    description: "Each 1/1 Faerie dies to Skullclamp's -1 toughness and draws two cards.",
    type: "engine",
  },
  {
    id: "trail-goose",
    name: "Trail of Crumbs + Gilded Goose",
    required: ["Trail of Crumbs", "Gilded Goose"],
    result: "Repeatable card selection and mana every turn.",
    description: "Goose makes and eats Food on demand; every Food sacrificed lets Trail of Crumbs dig for a permanent.",
    type: "engine",
  },
  {
    id: "tithe-arena",
    name: "Smothering Tithe + Rhystic Study",
    required: ["Smothering Tithe", "Rhystic Study"],
    result: "Taxes every opponent's spell and draw.",
    description: "Opponents either pay for everything or hand you Treasure and cards.",
    type: "synergy",
  },
  {
    id: "sun-titan-tithe",
    name: "Sun Titan + Skullclamp",
    required: ["Sun Titan", "Skullclamp"],
    result: "Skullclamp returns every time Sun Titan enters or attacks.",
    description: "A destroyed Skullclamp costs 1 mana, so Sun Titan can rebuy it from the graveyard on each trigger.",
    type: "synergy",
  },
  {
    id: "altar-pitiless",
    name: "Ashnod's Altar + Pitiless Plunderer",
    required: ["Ashnod's Altar", "Pitiless Plunderer"],
    result: "Every sacrificed creature nets three mana.",
    description: "Altar gives two colorless and Plunderer adds a Treasure per creature death, which funds more plays and more sacrifice fodder.",
    type: "engine",
  },
  {
    id: "blood-artist-seer",
    name: "Blood Artist + Viscera Seer",
    required: ["Blood Artist", "Viscera Seer"],
    result: "Free sacrifice that drains and scries.",
    description: "A free outlet plus a death trigger converts every creature (and board wipe) into life loss for opponents.",
    type: "synergy",
  },
];
