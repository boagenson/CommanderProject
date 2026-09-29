"use client";

import { Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "./utils";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("inline-flex items-center gap-1 rounded-xl border border-line bg-bg-raised p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm text-muted transition-colors hover:text-ink data-[state=active]:bg-panel-3 data-[state=active]:text-gold-strong data-[state=active]:shadow [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
