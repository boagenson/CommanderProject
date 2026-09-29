import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_DECKLIST } from "../../src/lib/deck/sample";
import { mockScryfall } from "./scryfall-mock";

test.beforeEach(async ({ page }) => {
  await mockScryfall(page);
});

async function pickCommander(page: Page, query: string, option: string) {
  const box = page.getByRole("combobox", { name: "Commander" });
  await box.fill(query);
  await page.getByRole("option", { name: option }).click();
}

test("import → analyze → edit → upgrade → persist", async ({ page }) => {
  // 1–2. Open the app and create a deck
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "New Deck" }).first().click();

  // 3. Choose Frodo and Sam as commanders
  await page.getByLabel("Deck name").fill("Second Breakfast");
  await pickCommander(page, "Frodo", "Frodo, Adventurous Hobbit");
  await page.getByRole("button", { name: "Add Sam, Loyal Attendant" }).click();
  await expect(page.getByText("Sam, Loyal Attendant").first()).toBeVisible();

  // 4–5. Paste the list (plus one bogus line) and import
  await page.getByLabel("Paste decklist").fill(`${SAMPLE_DECKLIST}\n1 Notarealcard Xyzzy`);
  await page.getByRole("button", { name: "Import deck" }).click();
  await expect(page.getByText("1 line couldn't be added")).toBeVisible();
  await expect(page.getByText("1 Notarealcard Xyzzy")).toBeVisible();
  await page.getByRole("link", { name: "Open in Deck Builder" }).click();

  // Header shows a legal 100-card deck
  await expect(page.getByRole("heading", { name: "Second Breakfast" })).toBeVisible();
  await expect(page.getByText("100/100 cards")).toBeVisible();
  await expect(page.getByText("Commander legal")).toBeVisible();

  // 6. Card artwork and information
  await expect(page.getByRole("heading", { name: /Creatures/ })).toBeVisible();
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(page.getByRole("img", { name: /Academy Manufactor/ })).toBeVisible();
  await page.getByRole("button", { name: "List" }).click();

  await page.getByRole("button", { name: "Academy Manufactor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("instead create one of each")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /View on Scryfall/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  // 12. Lock a card
  await page.getByRole("button", { name: "Lock Birds of Paradise" }).click();
  await expect(page.getByRole("button", { name: "Unlock Birds of Paradise" })).toBeVisible();

  // 7–8. Analysis
  await page.getByRole("tab", { name: "Analysis" }).click();
  await expect(page.getByRole("heading", { name: "Mana curve" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deck health" })).toBeVisible();
  const ramp = page.locator("dl > div", { hasText: "Ramp" }).first();
  await expect(ramp).toContainText(/\d+/);

  // 9. Themes
  await page.getByRole("tab", { name: "Themes" }).click();
  await expect(page.getByRole("heading", { name: "Food", exact: true })).toBeVisible();
  await expect(page.getByText(/Artifact token multiplication/).first()).toBeVisible();

  // 11. Remove a card
  await page.getByRole("tab", { name: "Cards" }).click();
  await page.getByRole("button", { name: "Remove Sun Titan" }).click();
  await expect(page.getByText("99/100 cards")).toBeVisible();

  // 10–11. Search for a card and add it
  await page.getByRole("link", { name: "Card Search" }).first().click();
  await page.getByLabel("Name").fill("Mirkwood");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 card found")).toBeVisible();
  await page.getByRole("button", { name: "Add to Deck" }).click();
  await expect(page.getByText(/Added Mirkwood Bats/)).toBeVisible();

  // 13–15. Upgrade workshop
  await page.getByRole("link", { name: "Upgrade Workshop" }).first().click();
  await page.getByRole("button", { name: "$25" }).click();
  await page.getByRole("button", { name: "Generate suggestions" }).click();
  await expect(page.getByRole("heading", { name: "Proposed swaps" })).toBeVisible();
  const swaps = page.locator("li", { has: page.getByRole("button", { name: /^Accept$/ }) });
  await expect(swaps.first()).toBeVisible();
  // Locked card is never a cut
  await expect(page.getByText("Why cut Birds of Paradise")).toHaveCount(0);
  await expect(swaps.first()).toContainText("Why add");

  await page.getByRole("button", { name: "Accept all" }).click();
  await expect(page.getByRole("heading", { name: /Compare: current vs. proposed/ })).toBeVisible();
  await expect(page.getByText("Your deck hasn't changed yet.")).toBeVisible();
  await page.getByRole("button", { name: "Commit changes" }).click();
  await expect(page.getByText(/Applied \d+ swaps? to Second Breakfast/)).toBeVisible();

  // 16. Saved locally and reopened later
  await page.reload();
  await page.goto("/decks");
  await page.locator("#main").getByRole("link", { name: "Second Breakfast" }).click();
  await expect(page.getByText("100/100 cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock Birds of Paradise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mirkwood Bats", exact: true })).toBeVisible();
});

test("sample deck loads and shows themes @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /sample/i }).first().click();
  await expect(page.getByRole("heading", { name: "Second Breakfast (Sample)" })).toBeVisible();
  await page.getByRole("tab", { name: "Themes" }).click();
  await expect(page.getByRole("heading", { name: "Food", exact: true })).toBeVisible();
});

test("shows a helpful error when Scryfall is unreachable", async ({ page }) => {
  await page.route("https://api.scryfall.com/**", (route) => route.abort("failed"));
  await page.goto("/decks/new");
  await page.getByLabel("Paste decklist").fill("1 Sol Ring\n1 Birds of Paradise");
  await page.getByRole("button", { name: "Import deck" }).click();
  await expect(page.getByText(/Couldn't reach Scryfall/).first()).toBeVisible({ timeout: 20_000 });
});
