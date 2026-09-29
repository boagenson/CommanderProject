"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/utils";
import { useDecks } from "@/lib/state/deck-store";
import { NAV_ITEMS } from "./nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/builder") return pathname.startsWith("/builder") || /^\/decks\/(?!new)[^/]+/.test(pathname);
  if (href === "/decks") return pathname === "/decks" || pathname === "/decks/new";
  return pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 rounded-lg px-2 py-1">
      <span className="grid size-9 place-items-center rounded-xl border border-gold/50 bg-gradient-to-br from-[#3a2c18] to-[#1b1510] shadow-[0_0_20px_#c9a25a22]">
        <svg viewBox="0 0 24 24" className="size-5 text-gold-strong" aria-hidden>
          <path fill="currentColor" d="M12 2l2.4 5.6L20 8.2l-4.3 3.9 1.3 5.9L12 15l-5 3 1.3-5.9L4 8.2l5.6-.6z" opacity=".9" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] tracking-wider text-ink group-hover:text-gold-strong">Commander</span>
        <span className="block text-[10px] uppercase tracking-[0.3em] text-gold">Workshop</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { preferences, decks } = useDecks();
  const active = decks.find((d) => d.id === preferences.activeDeckId);
  return (
    <nav aria-label="Main">
      <ul className="grid gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const current = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  current
                    ? "bg-gradient-to-r from-gold-soft to-transparent text-gold-strong shadow-[inset_2px_0_0_var(--gold)]"
                    : "text-ink-2 hover:bg-panel-3/60 hover:text-ink",
                )}
              >
                <Icon className={cn("size-4 transition-transform group-hover:scale-110", current ? "text-gold-strong" : "text-muted")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {active && (
        <div className="mt-6 rounded-xl border border-line bg-bg-raised/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Active deck</p>
          <Link href={`/decks/${active.id}`} onClick={onNavigate} className="mt-1 block truncate font-display text-sm text-ink hover:text-gold-strong">
            {active.name}
          </Link>
        </div>
      )}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-gold px-3 py-2 text-parchment-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line/70 bg-bg-raised/60 px-4 py-6 backdrop-blur lg:flex">
        <Brand />
        <NavList />
        <p className="mt-auto px-2 text-[10px] leading-relaxed text-muted">
          Card data and images from Scryfall. Not affiliated with Wizards of the Coast.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-bg/85 px-4 py-2 backdrop-blur lg:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-ink-2 hover:bg-panel-3"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        {open && (
          <div id="mobile-nav" className="border-b border-line bg-bg-raised px-4 py-4 lg:hidden">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-gold">{eyebrow}</p>}
        <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
