/**
 * Playwright route handlers that stand in for api.scryfall.com and the
 * image CDN using recorded fixtures, so E2E tests run offline and deterministically.
 */
import type { Page, Route } from "@playwright/test";
import { FIXTURE_CARDS, FIXTURE_BY_NAME, CANDIDATE_NAMES } from "../fixtures/cards";
import type { ScryfallCard } from "../../src/lib/scryfall/types";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

const notFound = (route: Route, details = "No card found.") =>
  json(route, { object: "error", status: 404, code: "not_found", details }, 404);

const byName = (name: string) => FIXTURE_BY_NAME.get(name.toLowerCase().split(" // ")[0]);

/** Very small subset of Scryfall syntax: name:, o:, t: terms. */
function searchFixtures(q: string): ScryfallCard[] {
  if (q.includes("(")) {
    // Upgrade candidate queries use OR groups; serve the candidate pool.
    return CANDIDATE_NAMES.map((n) => FIXTURE_BY_NAME.get(n.toLowerCase())!);
  }
  const terms = [...q.matchAll(/(name|o|t):("([^"]+)"|\S+)/g)].map((m) => ({ key: m[1], value: (m[3] ?? m[2]).toLowerCase() }));
  return FIXTURE_CARDS.filter((c) =>
    terms.every(({ key, value }) =>
      key === "name" ? c.name.toLowerCase().includes(value) : key === "o" ? (c.oracle_text ?? "").toLowerCase().includes(value) : (c.type_line ?? "").toLowerCase().includes(value),
    ),
  );
}

function cardSvg(name: string) {
  const safe = name.replace(/[<&>"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2c18"/><stop offset="1" stop-color="#1b2433"/></linearGradient></defs>
<rect width="488" height="680" rx="24" fill="#111"/><rect x="18" y="18" width="452" height="644" rx="16" fill="url(#g)"/>
<rect x="34" y="34" width="420" height="44" rx="8" fill="#e8dcc0"/><text x="48" y="64" font-family="Georgia" font-size="22" fill="#2b2219">${safe}</text>
<rect x="34" y="96" width="420" height="300" rx="6" fill="#c9a25a" opacity=".35"/></svg>`;
}

export async function mockScryfall(page: Page) {
  await page.route("https://cards.scryfall.io/**", (route) => {
    const id = route.request().url().split("/").pop()!.replace(".jpg", "");
    const card = FIXTURE_CARDS.find((c) => c.id === id);
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: cardSvg(card?.name ?? "Card") });
  });

  await page.route("https://api.scryfall.com/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/cards/collection" && route.request().method() === "POST") {
      const { identifiers } = route.request().postDataJSON() as { identifiers: Record<string, string>[] };
      const data: ScryfallCard[] = [];
      const not_found: unknown[] = [];
      for (const ident of identifiers) {
        const card = ident.name
          ? byName(ident.name)
          : FIXTURE_CARDS.find((c) => c.set === ident.set && c.collector_number === ident.collector_number);
        if (card && (!ident.set || !ident.name || card.set === ident.set)) data.push(card);
        else not_found.push(ident);
      }
      return json(route, { object: "list", data, not_found, has_more: false });
    }

    if (path === "/cards/named") {
      const exact = url.searchParams.get("exact");
      const fuzzy = url.searchParams.get("fuzzy");
      if (exact) return byName(exact) ? json(route, byName(exact)) : notFound(route);
      if (fuzzy) {
        const f = fuzzy.toLowerCase().replace(/[^a-z]/g, "");
        const card = FIXTURE_CARDS.find((c) => c.name.toLowerCase().replace(/[^a-z]/g, "").includes(f));
        return card ? json(route, card) : notFound(route);
      }
    }

    if (path === "/cards/autocomplete") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const data = FIXTURE_CARDS.map((c) => c.name).filter((n) => n.toLowerCase().includes(q)).slice(0, 20);
      return json(route, { object: "catalog", data });
    }

    if (path === "/cards/search") {
      const data = searchFixtures(url.searchParams.get("q") ?? "");
      if (!data.length) return notFound(route, "Your query didn't match any cards.");
      return json(route, { object: "list", data, total_cards: data.length, has_more: false });
    }

    if (path === "/sets") {
      return json(route, { object: "list", has_more: false, data: [{ code: "ltc", name: "Tales of Middle-earth Commander", set_type: "commander" }] });
    }

    return notFound(route, `Unmocked Scryfall path ${path}`);
  });
}
