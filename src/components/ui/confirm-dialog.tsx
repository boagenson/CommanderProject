"use client";

import { AlertDialog as A } from "radix-ui";
import * as React from "react";
import { buttonVariants } from "./button";
import { cn } from "./utils";

/** Confirmation for destructive actions. Keyboard-friendly (Radix AlertDialog). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-panel p-5 shadow-2xl animate-rise focus:outline-none">
          <A.Title className="font-display text-lg text-ink">{title}</A.Title>
          {description && <A.Description className="mt-2 text-sm text-ink-2">{description}</A.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Cancel</A.Cancel>
            <A.Action className={cn(buttonVariants({ variant: destructive ? "danger" : "primary", size: "sm" }))} onClick={onConfirm}>
              {confirmLabel}
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
