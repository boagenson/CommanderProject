import * as React from "react";
import { cn } from "./utils";

const field =
  "w-full rounded-lg border border-line bg-bg-raised px-3 text-sm text-ink placeholder:text-muted/80 transition-colors hover:border-line-strong focus:border-gold/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-gold/25 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-32 py-2 font-mono text-[13px] leading-5", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, "h-10 appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23948a7d' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium tracking-wide text-ink-2", className)} {...props} />;
}
