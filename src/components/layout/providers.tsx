"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { useDeckStore } from "@/lib/state/deck-store";
import { useToasts } from "@/lib/state/toast-store";

function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border bg-panel-2 px-4 py-3 text-sm text-ink shadow-2xl animate-rise",
            t.tone === "error" ? "border-danger/50" : t.tone === "success" ? "border-ok/50" : "border-line-strong",
          )}
        >
          <p className="flex-1">{t.message}</p>
          {t.action && (
            <button
              type="button"
              className="text-xs font-medium text-gold-strong hover:underline"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const load = useDeckStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <TooltipProvider delayDuration={250}>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
