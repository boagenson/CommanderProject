"use client";

import { Target } from "lucide-react";
import { useEffect, useState } from "react";
import type { DeckDoctorReport, DeckIntent, PlayerPriority, StrategyName, UpgradePhilosophy } from "@/lib/types";
import { PLAYER_PRIORITIES, STRATEGIES, STRATEGY_NAMES, UPGRADE_PHILOSOPHIES } from "@/lib/types";
import { STRATEGY_DESCRIPTIONS } from "@/lib/doctor/strategy";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Tooltip } from "@/components/ui/tooltip";

const PHILOSOPHY_HINTS: Record<UpgradePhilosophy, string> = {
  "Preserve Theme": "Generic staples score lower; Favorite and Flavor Essential cards are effectively off-limits.",
  Balanced: "Weighs synergy and efficiency evenly; Favorites are never cut.",
  "Maximum Optimization": "Efficiency first. Favorites may be suggested as cuts (with a warning); Locked cards still never are.",
};

/** Editable Deck Intent. Saves on every change; the free-text goals save on blur. */
export function IntentEditor({ intent, report, onChange }: { intent: DeckIntent; report: DeckDoctorReport | null; onChange: (intent: DeckIntent) => void }) {
  const [goals, setGoals] = useState(intent.goals);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resync when another view changes the saved intent
  useEffect(() => setGoals(intent.goals), [intent.goals]);
  const detected = report?.archetypes ?? [];
  const detectedPrimary = detected[0];
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Panel>
      <PanelHeader title="Deck Intent" icon={<Target />} description="Tell Commander Workshop what this deck should accomplish. These settings shape Deck Doctor findings and every upgrade recommendation." />
      <PanelBody className="grid gap-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-2">Desired power / optimization</legend>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGIES.map((s) => (
              <ToggleChip key={s} pressed={intent.power === s} onPressedChange={() => onChange({ ...intent, power: s })}>
                {s}
              </ToggleChip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">A relative target for this table, not a universal power number.</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="intent-primary">Primary strategy</Label>
            <Select id="intent-primary" value={intent.primaryStrategy ?? ""} onChange={(e) => onChange({ ...intent, primaryStrategy: (e.target.value || undefined) as StrategyName | undefined })}>
              <option value="">{detectedPrimary ? `Auto-detect (${detectedPrimary.name})` : "Auto-detect"}</option>
              {STRATEGY_NAMES.map((s) => {
                const d = detected.find((x) => x.name === s);
                return (
                  <option key={s} value={s}>
                    {s}
                    {d ? ` · detected ${d.score}` : ""}
                  </option>
                );
              })}
            </Select>
            <p className="mt-1 text-[11px] text-muted">{STRATEGY_DESCRIPTIONS[intent.primaryStrategy ?? detectedPrimary?.name ?? "Control"]}</p>
          </div>
          <div>
            <Label htmlFor="intent-philosophy">Upgrade philosophy</Label>
            <Select id="intent-philosophy" value={intent.philosophy} onChange={(e) => onChange({ ...intent, philosophy: e.target.value as UpgradePhilosophy })}>
              {UPGRADE_PHILOSOPHIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-muted">{PHILOSOPHY_HINTS[intent.philosophy]}</p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-2">Secondary strategies</legend>
          <div className="flex flex-wrap gap-1.5">
            {[...detected.filter((d) => d.name !== (intent.primaryStrategy ?? detectedPrimary?.name)).map((d) => d.name), ...STRATEGY_NAMES]
              .filter((s, i, arr) => arr.indexOf(s) === i && s !== (intent.primaryStrategy ?? detectedPrimary?.name))
              .slice(0, 14)
              .map((s) => {
                const d = detected.find((x) => x.name === s);
                return (
                  <Tooltip key={s} content={`${STRATEGY_DESCRIPTIONS[s]}${d ? ` Detected strength ${d.score}.` : ""}`}>
                    <ToggleChip pressed={intent.secondaryStrategies.includes(s)} onPressedChange={() => onChange({ ...intent, secondaryStrategies: toggle(intent.secondaryStrategies, s) })}>
                      {s}
                      {d && <span className="text-[10px] text-muted">{d.score}</span>}
                    </ToggleChip>
                  </Tooltip>
                );
              })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink-2">Player priorities</legend>
          <div className="flex flex-wrap gap-1.5">
            {PLAYER_PRIORITIES.map((p: PlayerPriority) => (
              <ToggleChip key={p} pressed={intent.priorities.includes(p)} onPressedChange={() => onChange({ ...intent, priorities: toggle(intent.priorities, p) })}>
                {p}
              </ToggleChip>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="intent-goals">Deck goals, in your own words</Label>
          <Textarea
            id="intent-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            onBlur={() => goals !== intent.goals && onChange({ ...intent, goals })}
            placeholder="I want this Frodo and Sam deck to remain heavily Lord of the Rings themed, but I want the Food and artifact-token engine to be more consistent. I don't want to turn it into a generic Abzan good-stuff deck."
            className="min-h-24 font-sans"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              Stored with the deck. The local engine reads strategy words, theme words and phrases like &ldquo;not generic&rdquo; or &ldquo;more consistent&rdquo;; a future AI advisor will receive the whole text.
            </p>
            {goals !== intent.goals && (
              <Button size="sm" variant="primary" onClick={() => onChange({ ...intent, goals })}>
                Save goals
              </Button>
            )}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
