import { DeckWorkspace } from "@/components/builder/deck-workspace";

export default async function DeckPage({ params }: PageProps<"/decks/[id]">) {
  const { id } = await params;
  return <DeckWorkspace id={id} />;
}
