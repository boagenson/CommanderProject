import { CircleCheck, Info, TriangleAlert, CircleX } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

type Tone = "info" | "warning" | "error" | "success";
const styles: Record<Tone, string> = {
  info: "border-info/35 bg-info/8 text-ink-2 [&>svg]:text-info",
  warning: "border-warn/35 bg-warn/8 text-ink-2 [&>svg]:text-warn",
  error: "border-danger/40 bg-danger/8 text-ink-2 [&>svg]:text-danger",
  success: "border-ok/35 bg-ok/8 text-ink-2 [&>svg]:text-ok",
};
const icons = { info: Info, warning: TriangleAlert, error: CircleX, success: CircleCheck };

/** Inline status message. Icon + text, never color alone. */
export function Callout({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3 text-sm", styles[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-[13px]")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-panel-3/70", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      {icon && <div className="rounded-full border border-gold/30 bg-gold-soft p-3 text-gold-strong [&_svg]:size-6">{icon}</div>}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
