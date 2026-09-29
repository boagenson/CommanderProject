"use client";

import { HoverCard } from "radix-ui";
import * as React from "react";
import type { Card } from "@/lib/types";
import { CardImage } from "./card-image";

/**
 * Wraps a card name; hovering (or focusing) it shows the card image.
 * Touch devices skip it, since tapping already opens the detail panel.
 */
export function CardHoverPreview({ card, children }: { card: Card; children: React.ReactNode }) {
  return (
    <HoverCard.Root openDelay={350} closeDelay={80}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="right"
          sideOffset={12}
          collisionPadding={12}
          className="z-40 hidden w-56 data-[state=open]:animate-rise [@media(hover:hover)]:block"
        >
          <CardImage card={card} size="normal" className="shadow-[0_18px_40px_#000c] ring-1 ring-line-strong" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
