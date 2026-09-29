import * as React from "react";
import { cn } from "./utils";

/** Rounded content panel; the app's basic surface. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("rounded-2xl border border-line bg-panel/90 shadow-[0_1px_0_#ffffff08_inset,0_10px_30px_#0006]", className)}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  icon,
  className,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4", className)}>
      <div className="min-w-0">
        <Heading className="flex items-center gap-2 font-display text-base tracking-wide text-ink">
          {icon && <span className="text-gold [&_svg]:size-4">{icon}</span>}
          {title}
        </Heading>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
