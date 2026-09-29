"use client";

import { Tooltip as T } from "radix-ui";
import * as React from "react";

export const TooltipProvider = T.Provider;

/** Accessible tooltip for icon buttons and abbreviations. */
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-72 rounded-md border border-line-strong bg-panel-3 px-2.5 py-1.5 text-xs text-ink shadow-xl data-[state=delayed-open]:animate-rise"
        >
          {content}
          <T.Arrow className="fill-panel-3" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
