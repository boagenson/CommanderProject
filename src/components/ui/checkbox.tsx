"use client";

import { Checkbox as C } from "radix-ui";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded border border-line-strong bg-bg-raised transition-colors data-[state=checked]:border-gold data-[state=checked]:bg-gold",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3 text-parchment-ink" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}
