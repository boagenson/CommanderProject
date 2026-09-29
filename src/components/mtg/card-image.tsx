"use client";

import { useState } from "react";
import type { Card } from "@/lib/types";
import { cardImage } from "@/lib/cards/helpers";
import { cn } from "@/components/ui/utils";

/** Lazy card image with a graceful text fallback when the image is missing. */
export function CardImage({
  card,
  size = "normal",
  className,
  priority,
}: {
  card: Card;
  size?: "small" | "normal" | "large";
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = cardImage(card, size);
  return (
    <div className={cn("relative aspect-[488/680] overflow-hidden rounded-[4.75%/3.5%] bg-panel-3 shadow-lg", className)}>
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Scryfall's CDN already serves sized images.
        <img
          src={src}
          alt={`${card.name}: ${card.typeLine}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col justify-between border border-line-strong p-3 text-left">
          <span className="font-display text-sm text-ink">{card.name}</span>
          <span className="text-[11px] text-muted">{card.typeLine}</span>
        </div>
      )}
    </div>
  );
}

/** Wide art crop, used for commander banners and deck tiles. */
export function CardArt({ card, className, alt }: { card?: Card; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const src = card?.images.artCrop ?? card?.images.normal;
  if (!card || !src || failed) {
    return <div aria-hidden className={cn("bg-gradient-to-br from-panel-3 via-panel-2 to-[#3a2a1a]", className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Scryfall's CDN already serves sized images.
    <img
      src={src}
      alt={alt ?? `Artwork for ${card.name}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
