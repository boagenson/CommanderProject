import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/app-shell";
import { CardSearch } from "@/components/search/card-search";

export const metadata: Metadata = { title: "Card Search" };

export default function SearchPage() {
  return (
    <>
      <PageHeader
        eyebrow="Scryfall"
        title="Card Search"
        description="Search every Magic card. With a deck selected, results are limited to (or sorted by) your commander's color identity."
      />
      <CardSearch />
    </>
  );
}
