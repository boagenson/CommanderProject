"use client";

import { Activity, CircleCheck, Crosshair, Info, Stethoscope, Swords, TriangleAlert, Unplug } from "lucide-react";
import { useMemo } from "react";
import type { Deck, DeckAnalysis, DeckDoctorReport, DetectedStrategy, DoctorFinding, WinConditionType } from "@/lib/types";
import { WIN_CONDITION_TYPES } from "@/lib/types";
import { getIntent } from "@/lib/deck/intent";
import { setIntent, setWinConditionOverride } from "@/lib/deck/operations";
import { buildDoctorReport } from "@/lib/doctor";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { toast } from "@/lib/state/toast-store";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { IntentEditor } from "./intent-editor";
import { PackagesPanel } from "@/components/synergy/packages-panel";

export function useDoctorReport(deck: Deck | undefined, analysis: DeckAnalysis | undefined) {
  return useMemo(() => (deck && analysis ? buildDoctorReport(deck, analysis) : null), [deck, analysis]);
}

/** The Deck Doctor tab: intent, strategy reading, strengths/weaknesses, win conditions, packages, combos. */
export function DeckDoctor({ deck, analysis, onOpenCard }: { deck: Deck; analysis: DeckAnalysis; onOpenCard: (name: string) => void }) {
  const edit = useDeckEditor(deck);
  const report = useDoctorReport(deck, analysis);
  const intent = getIntent(deck);
  if (!report) return null;

  return (
    <div className="grid gap-5">
      <IntentEditor
        intent={intent}
        report={report}
        onChange={(next) => {
          edit((d) => setIntent(d, next));
          toast("Deck intent saved.", "success");
        }}
      />

      <StrategyPanel report={report} />

      <div className="grid gap-5 lg:grid-cols-2">
        <FindingsPanel title="Strengths" icon={<CircleCheck />} findings={report.strengths} tone="ok" empty="Nothing stands out yet. Strengths appear once role counts or packages clear typical thresholds." onOpenCard={onOpenCard} />
        <FindingsPanel title="Potential weaknesses" icon={<TriangleAlert />} findings={report.weaknesses} tone="warn" empty="No obvious gaps against common Commander guidelines. That is a heuristic reading, not a verdict." onOpenCard={onOpenCard} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <RoleCoveragePanel report={report} onOpenCard={onOpenCard} />
        <FindingsPanel title="Mana concerns" icon={<Activity />} findings={report.manaConcerns} tone="info" empty="Colored sources roughly match colored pip requirements. Details are in Analysis → Mana Base Doctor." onOpenCard={onOpenCard} />
      </div>

      <WinConditionsPanel report={report} deck={deck} onOpenCard={onOpenCard} onToggle={(type, state) => edit((d) => setWinConditionOverride(d, type, state))} />

      <PackagesPanel packages={report.packages} combos={report.combos} onOpenCard={onOpenCard} />

      <DisconnectedPanel report={report} onOpenCard={onOpenCard} />
    </div>
  );
}

function StrategyPanel({ report }: { report: DeckDoctorReport }) {
  return (
    <Panel id="doctor-strategy">
      <PanelHeader title="What the deck is trying to do" icon={<Stethoscope />} description="Read from card text, themes and known combos. Correct it in Deck Intent above if the reading is off." />
      <PanelBody className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Commander strategy</p>
            <p className="mt-1 text-ink-2">{report.commanderStrategy}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Likely game plan</p>
            <p className="mt-1 text-ink-2">{report.gamePlan}</p>
          </div>
          {report.intentNotes.map((n, i) => (
            <Callout key={i} tone="info">
              {n}
            </Callout>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Primary</p>
            {report.primary ? <StrategyRow s={report.primary} primary /> : <p className="mt-1 text-sm text-muted">No dominant strategy detected yet.</p>}
          </div>
          {report.secondary.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted">Secondary</p>
              <ul className="mt-1 grid gap-1.5">
                {report.secondary.slice(0, 4).map((s) => (
                  <li key={s.name}>
                    <StrategyRow s={s} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.archetypes.length > (report.primary ? 1 : 0) + report.secondary.length && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted">Also detected</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {report.archetypes
                  .filter((a) => a.name !== report.primary?.name && !report.secondary.some((s) => s.name === a.name))
                  .map((a) => (
                    <Tooltip key={a.name} content={a.explanation}>
                      <span>
                        <Badge tone="neutral">
                          {a.name} <span className="text-muted">{a.score}</span>
                        </Badge>
                      </span>
                    </Tooltip>
                  ))}
              </div>
            </div>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}

function StrategyRow({ s, primary }: { s: DetectedStrategy; primary?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", primary ? "border-gold/40 bg-gold-soft/40" : "border-line bg-bg-raised/60")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-display text-sm", primary ? "text-gold-strong" : "text-ink")}>{s.name}</span>
        <span className="text-xs tabular-nums text-muted">{s.score ? `strength ${s.score}` : "chosen by you"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3" role="meter" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} strength`}>
        <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-strong" style={{ width: `${s.score}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-2">{s.explanation}</p>
    </div>
  );
}

const severityIcon = { error: TriangleAlert, warning: TriangleAlert, info: Info } as const;

function FindingsPanel({
  title,
  icon,
  findings,
  tone,
  empty,
  onOpenCard,
}: {
  title: string;
  icon: React.ReactNode;
  findings: DoctorFinding[];
  tone: "ok" | "warn" | "info";
  empty: string;
  onOpenCard: (name: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader as="h3" title={title} icon={icon} />
      <PanelBody className="grid gap-2">
        {findings.length === 0 && <p className="text-sm text-muted">{empty}</p>}
        {findings.map((f) => {
          const Icon = tone === "ok" ? CircleCheck : severityIcon[f.severity ?? "info"];
          return (
            <div key={f.id} className="flex gap-3 rounded-xl border border-line bg-bg-raised/70 p-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "ok" ? "text-ok" : f.severity === "warning" ? "text-warn" : "text-info")} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{f.title}</p>
                <p className="text-[13px] text-ink-2">{f.detail}</p>
                {f.cards && f.cards.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {f.cards.slice(0, 10).map((c) => (
                      <button key={c} type="button" onClick={() => onOpenCard(c)} className="rounded bg-panel-3 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-gold-strong">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

function RoleCoveragePanel({ report, onOpenCard }: { report: DeckDoctorReport; onOpenCard: (name: string) => void }) {
  return (
    <Panel>
      <PanelHeader as="h3" title="Role coverage" icon={<Crosshair />} description="Card advantage, interaction, ramp, protection, recursion and finishers compared with common guidelines. Targets are informational." />
      <PanelBody className="grid gap-2">
        {report.roleCoverage.map((r) => {
          const ratio = Math.min(1.5, r.count / Math.max(1, r.target));
          const tone = r.count < r.target * 0.6 ? "text-warn" : r.count > r.target * 1.8 ? "text-info" : "text-ok";
          return (
            <Tooltip key={r.role} content={r.note}>
              <div className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 rounded-lg px-1 py-1 text-sm hover:bg-panel-3/50">
                <button type="button" className="truncate text-left text-ink-2 hover:text-gold-strong" onClick={() => r.cards[0] && onOpenCard(r.cards[0])}>
                  {r.role}
                </button>
                <span className="relative h-1.5 overflow-hidden rounded-full bg-panel-3">
                  <span className={cn("block h-full rounded-full", r.count < r.target * 0.6 ? "bg-warn" : "bg-gold")} style={{ width: `${(ratio / 1.5) * 100}%` }} />
                  <span className="absolute top-0 h-full w-px bg-ink/40" style={{ left: `${(1 / 1.5) * 100}%` }} aria-hidden />
                </span>
                <span className={cn("text-right tabular-nums", tone)}>
                  {r.count}
                  <span className="text-muted">/{r.target}</span>
                </span>
              </div>
            </Tooltip>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

function WinConditionsPanel({
  report,
  deck,
  onOpenCard,
  onToggle,
}: {
  report: DeckDoctorReport;
  deck: Deck;
  onOpenCard: (name: string) => void;
  onToggle: (type: WinConditionType, state: "auto" | "on" | "off") => void;
}) {
  const w = report.winConditions;
  const add = new Set(deck.winConditionOverrides?.add ?? []);
  const remove = new Set(deck.winConditionOverrides?.remove ?? []);
  const shown = new Set(w.conditions.map((c) => c.type));
  return (
    <Panel id="doctor-wincons">
      <PanelHeader title="Win conditions" icon={<Swords />} description={w.note} actions={w.unclear ? <Badge tone="warn">No clear finisher</Badge> : undefined} />
      <PanelBody className="grid gap-4">
        {w.unclear && <Callout tone="warning" title="No clear finishing plan identified">Not every Commander deck needs an infinite combo, but games can stall without a way to convert an advantage. If you know how this deck wins, mark it below.</Callout>}
        <ul className="grid gap-2 md:grid-cols-2">
          {w.conditions.map((c) => (
            <li key={c.type} className={cn("rounded-xl border p-3", c.strength >= 35 ? "border-gold/40 bg-bg-raised/70" : "border-line bg-bg-raised/40")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm text-ink">{c.type}</span>
                <span className="flex items-center gap-2">
                  {c.manual && <Badge tone="gold">marked by you</Badge>}
                  <span className="text-xs tabular-nums text-muted">{c.strength}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3" role="meter" aria-valuenow={c.strength} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.type} strength`}>
                <div className={cn("h-full rounded-full", c.strength >= 35 ? "bg-gradient-to-r from-gold to-gold-strong" : "bg-line-strong")} style={{ width: `${c.strength}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-2">{c.explanation}</p>
              {c.cards.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.cards.slice(0, 6).map((n) => (
                    <button key={n} type="button" onClick={() => onOpenCard(n)} className="rounded bg-panel-3 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-gold-strong">
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <button type="button" className="text-[11px] text-muted hover:text-danger" onClick={() => onToggle(c.type, remove.has(c.type) ? "auto" : "off")}>
                  Not how this deck wins
                </button>
                {c.manual && (
                  <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => onToggle(c.type, "auto")}>
                    · back to auto
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">Mark a win condition the app missed</p>
          <div className="flex flex-wrap gap-1.5">
            {WIN_CONDITION_TYPES.filter((t) => !shown.has(t) || remove.has(t)).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(t, add.has(t) ? "auto" : "on")}
                className={cn("rounded-full border px-2.5 py-1 text-xs", remove.has(t) ? "border-line text-muted line-through hover:text-ink" : "border-line text-ink-2 hover:border-gold/60 hover:text-gold-strong")}
                title={remove.has(t) ? "Hidden by you; click to restore" : "Mark as a win condition"}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function DisconnectedPanel({ report, onOpenCard }: { report: DeckDoctorReport; onOpenCard: (name: string) => void }) {
  return (
    <Panel>
      <PanelHeader as="h3" title="Cards less connected to the primary strategy" icon={<Unplug />} description="Nonland cards with no detected utility role and few synergy links. Not a verdict: flavor picks and standalone threats show up here too." />
      <PanelBody>
        {report.disconnected.length === 0 ? (
          <p className="text-sm text-muted">Every nonland card has a utility role or a synergy link to the deck&apos;s themes.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {report.disconnected.map((d) => (
              <li key={d.name} className="rounded-xl border border-line bg-bg-raised/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onOpenCard(d.name)} className="font-display text-sm text-ink hover:text-gold-strong">
                    {d.name}
                  </button>
                  <span className="text-xs tabular-nums text-muted">connection {d.connection}</span>
                </div>
                <p className="mt-1 text-xs text-ink-2">{d.note}</p>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

