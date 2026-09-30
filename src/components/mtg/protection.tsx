"use client";

import { Heart, Lock, LockOpen, Sparkle } from "lucide-react";
import type { DeckCard, ProtectionLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

export const PROTECTION_META: Record<ProtectionLevel, { label: string; icon: typeof Lock; hint: string; on: string }> = {
  locked: { label: "Locked", icon: Lock, hint: "Locked: upgrades never suggest cutting this card.", on: "text-gold-strong" },
  favorite: { label: "Favorite", icon: Heart, hint: "Favorite: only cut under Maximum Optimization.", on: "text-danger" },
  flavor: { label: "Flavor Essential", icon: Sparkle, hint: "Flavor Essential: thematic relevance counts heavily when weighing cuts.", on: "text-info" },
};

export function protectionLevels(dc: Pick<DeckCard, "locked" | "favorite" | "flavorEssential">): ProtectionLevel[] {
  const out: ProtectionLevel[] = [];
  if (dc.locked) out.push("locked");
  if (dc.favorite) out.push("favorite");
  if (dc.flavorEssential) out.push("flavor");
  return out;
}

/** Small status icons shown next to a card name. */
export function ProtectionBadges({ dc, className }: { dc: Pick<DeckCard, "locked" | "favorite" | "flavorEssential">; className?: string }) {
  const levels = protectionLevels(dc);
  if (!levels.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {levels.map((l) => {
        const { icon: Icon, label, on } = PROTECTION_META[l];
        return <Icon key={l} className={cn("size-3 shrink-0", on)} aria-label={label} />;
      })}
    </span>
  );
}

/** Three toggle buttons for Locked / Favorite / Flavor Essential. */
export function ProtectionToggles({
  dc,
  onChange,
  size = "sm",
  compact,
}: {
  dc: Pick<DeckCard, "locked" | "favorite" | "flavorEssential">;
  onChange: (level: ProtectionLevel, on: boolean) => void;
  size?: "sm" | "icon-sm";
  compact?: boolean;
}) {
  const active = new Set(protectionLevels(dc));
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Protection">
      {(Object.keys(PROTECTION_META) as ProtectionLevel[]).map((level) => {
        const meta = PROTECTION_META[level];
        const on = active.has(level);
        const Icon = level === "locked" && !on ? LockOpen : meta.icon;
        return (
          <Tooltip key={level} content={meta.hint}>
            <Button
              size={compact ? "icon-sm" : size}
              variant={on ? "outline" : "ghost"}
              aria-pressed={on}
              aria-label={`${on ? "Remove" : "Mark"} ${meta.label}`}
              onClick={() => onChange(level, !on)}
              className={cn(on && meta.on)}
            >
              <Icon />
              {!compact && meta.label}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
}
