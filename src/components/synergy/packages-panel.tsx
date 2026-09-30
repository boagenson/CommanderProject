"use client";

import { Boxes, Infinity as InfinityIcon, Link2, Zap } from "lucide-react";
import type { DetectedCombo, SynergyPackage } from "@/lib/types";
import { COMBO_TYPE_LABELS } from "@/lib/combo/engine";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/components/ui/utils";

function NameChips({ names, onOpenCard, tone }: { names: string[]; onOpenCard: (n: string) => void; tone?: "gold" | "neutral" }) {
  if (!names.length) return <span className="text-xs text-muted">None yet.</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((n) => (
        <button key={n} type="button" onClick={() => onOpenCard(n)} className={cn("rounded-md border px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold-strong", tone === "gold" ? "border-gold/40 text-gold-strong" : "border-line text-ink-2")}>
          {n}
        </button>
      ))}
    </div>
  );
}

/** Synergy packages plus Combos & Engines, with the three combo types clearly separated. */
export function PackagesPanel({ packages, combos, onOpenCard }: { packages: SynergyPackage[]; combos: DetectedCombo[]; onOpenCard: (name: string) => void }) {
  const present = combos.filter((c) => c.type !== "near");
  const near = combos.filter((c) => c.type === "near");
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <Panel id="doctor-packages">
        <PanelHeader title="Synergy packages" icon={<Boxes />} description="Groups of cards that function together. Enablers make the resource, payoffs reward it, support cards touch the mechanic without doing either." />
        <PanelBody className="grid gap-3">
          {packages.length === 0 && <p className="text-sm text-muted">No packages yet. They appear once a theme has both enablers and payoffs.</p>}
          {packages.map((p) => (
            <details key={p.id} className="group rounded-xl border border-line bg-bg-raised/60 open:border-gold/30" open={p.strength >= 50}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                <span className="font-display text-sm text-ink">{p.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {p.enablers.length}E · {p.payoffs.length}P · {p.support.length}S
                  <Badge tone={p.strength >= 50 ? "gold" : "neutral"}>{p.strength}</Badge>
                </span>
              </summary>
              <div className="grid gap-3 border-t border-line/60 px-3 py-3">
                <p className="text-[13px] text-ink-2">{p.purpose}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Enablers</p>
                    <NameChips names={p.enablers} onOpenCard={onOpenCard} />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Payoffs</p>
                    <NameChips names={p.payoffs} onOpenCard={onOpenCard} tone="gold" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Support</p>
                    <NameChips names={p.support} onOpenCard={onOpenCard} />
                  </div>
                </div>
              </div>
            </details>
          ))}
        </PanelBody>
      </Panel>

      <Panel id="doctor-combos">
        <PanelHeader title="Combos & Engines" icon={<Zap />} description="Known card combinations from the combo database, matched by name. Nothing here is inferred from card text alone." />
        <PanelBody className="grid gap-2">
          {present.length === 0 && <p className="text-sm text-muted">No known combos or engines in this deck. Many Commander decks win without one.</p>}
          {present.map((c) => (
            <ComboRow key={c.definition.id} combo={c} onOpenCard={onOpenCard} />
          ))}
          {near.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                {near.length} near-combo{near.length === 1 ? "" : "s"}: one card away
              </summary>
              <div className="mt-2 grid gap-2">
                {near.map((c) => (
                  <ComboRow key={c.definition.id} combo={c} onOpenCard={onOpenCard} />
                ))}
              </div>
            </details>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

const COMBO_TONE = { infinite: "danger", engine: "gold", synergy: "info", near: "neutral" } as const;

function ComboRow({ combo, onOpenCard }: { combo: DetectedCombo; onOpenCard: (n: string) => void }) {
  const Icon = combo.type === "infinite" ? InfinityIcon : combo.type === "engine" ? Zap : Link2;
  return (
    <div className={cn("rounded-xl border p-3", combo.type === "infinite" ? "border-danger/40 bg-danger/5" : combo.type === "engine" ? "border-gold/30 bg-bg-raised/70" : "border-line bg-bg-raised/50")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm text-ink">
          <Icon className="size-4 text-gold" aria-hidden /> {combo.definition.name}
        </span>
        <Badge tone={COMBO_TONE[combo.type]}>{COMBO_TYPE_LABELS[combo.type]}</Badge>
      </div>
      <p className="mt-1 text-[13px] text-ink-2">
        <span className="text-ink">{combo.definition.result}</span> {combo.definition.description}
      </p>
      {combo.definition.requirements && combo.definition.requirements.length > 0 && <p className="mt-1 text-[11px] text-muted">Needs: {combo.definition.requirements.join("; ")}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <NameChips names={combo.present} onOpenCard={onOpenCard} tone="gold" />
        {combo.missing.length > 0 && (
          <span className="text-[11px] text-muted">
            missing: <span className="text-warn">{combo.missing.join(", ")}</span>
          </span>
        )}
        {combo.optionalPresent.length > 0 && <span className="text-[11px] text-muted">+ {combo.optionalPresent.join(", ")}</span>}
      </div>
    </div>
  );
}
