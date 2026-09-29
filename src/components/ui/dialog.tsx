"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  side,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** "right" renders a slide-over panel instead of a centered modal. */
  side?: "right";
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-[rise_.2s_ease-out]" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border border-line-strong bg-panel shadow-2xl focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-xl overflow-y-auto sm:rounded-l-2xl"
            : "left-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl",
          "data-[state=open]:animate-rise",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <D.Title className="font-display text-lg text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-xs text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">Details</D.Description>
            )}
          </div>
          <D.Close className="rounded-md p-1.5 text-muted hover:bg-panel-3 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="p-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
