"use client";

import { ArrowRight, Check, Lock, X } from "lucide-react";
import type { UpgradeSuggestion } from "@/lib/types";
import { formatPrice } from "@/lib/cards/helpers";
import { CardImage } from "@/components/mtg/card-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

export type SwapState = "pending" | "accepted" | "rejected";

const signed = (n: number, fmt: (n: number) => string = String) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : "±0");

/** One REMOVE → ADD proposal with its reasoning and approve/reject controls. */
export function SwapCard({
  swap,
  state,
  onAccept,
  onReject,
  onLockInstead,
  onOpenCard,
}: {
  swap: UpgradeSuggestion;
  state: SwapState;
  onAccept: () => void;
  onReject: () => void;
  onLockInstead: () => void;
  onOpenCard: (name: "remove" | "add") => void;
}) {
  const lostCats = swap.removedCategories.filter((c) => !swap.addedCategories.includes(c));
  const newCats = swap.addedCategories.filter((c) => !swap.removedCategories.includes(c));
  return (
    <li
      className={cn(
        "rounded-2xl border bg-panel p-4 transition-all animate-rise",
        state === "accepted" ? "border-ok/50 shadow-[0_0_0_1px_#62b57d33]" : state === "rejected" ? "border-line opacity-55" : "border-line hover:border-line-strong",
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SwapSide label="Remove" tone="danger" name={swap.remove.name} onOpen={() => onOpenCard("remove")}>
          <CardImage card={swap.remove} size="small" className="w-full" />
        </SwapSide>
        <ArrowRight className="size-5 text-gold" aria-label="replaced by" />
        <SwapSide label="Add" tone="ok" name={swap.add.name} onOpen={() => onOpenCard("add")}>
          <CardImage card={swap.add} size="small" className="w-full" />
        </SwapSide>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-bg-raised px-2 py-1.5">
          <dt className="text-muted">Price</dt>
          <dd className={cn("tabular-nums", swap.priceDelta > 0 ? "text-warn" : "text-ok")}>{signed(swap.priceDelta, (n) => formatPrice(n))}</dd>
          <dd className="text-[10px] text-muted">{formatPrice(swap.add.prices.usd)} to buy</dd>
        </div>
        <div className="rounded-lg bg-bg-raised px-2 py-1.5">
          <dt className="text-muted">Mana value</dt>
          <dd className="tabular-nums text-ink">{signed(swap.manaValueDelta)}</dd>
          <dd className="text-[10px] text-muted">
            {swap.remove.cmc} → {swap.add.cmc}
          </dd>
        </div>
        <div className="rounded-lg bg-bg-raised px-2 py-1.5">
          <dt className="text-muted">Categories</dt>
          <dd className="flex flex-wrap justify-center gap-1 pt-0.5">
            {newCats.map((c) => (
              <Badge key={c} tone="ok">+{c}</Badge>
            ))}
            {lostCats.map((c) => (
              <Badge key={c} tone="warn">−{c}</Badge>
            ))}
            {!newCats.length && !lostCats.length && <span className="text-muted">No change</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid gap-1 text-[13px] leading-relaxed">
        <p className="text-ink-2">
          <span className="font-medium text-ok">Why add {swap.add.name}: </span>
          {swap.explanation}
        </p>
        <p className="text-ink-2">
          <span className="font-medium text-warn">Why cut {swap.remove.name}: </span>
          {swap.removeReason}
          {swap.removeProtection && (
            <Badge tone={swap.removeProtection === "favorite" ? "danger" : "info"} className="ml-2 align-middle">
              {swap.removeProtection === "favorite" ? "Favorite" : "Flavor Essential"}
            </Badge>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={state === "accepted" ? "success" : "secondary"} onClick={onAccept} aria-pressed={state === "accepted"}>
          <Check /> {state === "accepted" ? "Accepted" : "Accept"}
        </Button>
        <Button size="sm" variant={state === "rejected" ? "danger" : "ghost"} onClick={onReject} aria-pressed={state === "rejected"}>
          <X /> {state === "rejected" ? "Rejected" : "Reject"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onLockInstead} className="ml-auto">
          <Lock /> Keep & lock {swap.remove.name.split(",")[0]}
        </Button>
      </div>
    </li>
  );
}

function SwapSide({ label, tone, name, onOpen, children }: { label: string; tone: "ok" | "danger"; name: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-1.5 text-center">
      <Badge tone={tone}>{label}</Badge>
      <button type="button" onClick={onOpen} className="w-full max-w-[110px] transition-transform hover:-translate-y-0.5" aria-label={`Details for ${name}`}>
        {children}
      </button>
      <p className="line-clamp-2 text-xs text-ink">{name}</p>
    </div>
  );
}
