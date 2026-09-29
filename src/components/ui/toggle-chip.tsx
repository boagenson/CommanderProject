"use client";

import * as React from "react";
import { cn } from "./utils";

/** Pill toggle button with aria-pressed; used for filters, goals and presets. */
export function ToggleChip({
  pressed,
  onPressedChange,
  className,
  children,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all [&_svg]:size-3.5",
        pressed
          ? "border-gold/70 bg-gold-soft text-gold-strong shadow-[0_0_0_1px_#c9a25a33]"
          : "border-line bg-bg-raised text-ink-2 hover:border-line-strong hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
