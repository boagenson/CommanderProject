"use client";

/**
 * Deck version history: snapshot the current list with notes, browse the
 * change log, and compare any two versions side by side.
 */
import { GitCompare, History, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Deck, DeckAnalysis, DeckVersion } from "@/lib/types";
import { formatMetric } from "@/lib/analysis/compare";
import { formatPrice } from "@/lib/cards/helpers";
import { addVersion, compareVersions, createVersion, hasUnversionedChanges, removeVersion } from "@/lib/deck/versions";
import { useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { useDeckEditor } from "@/lib/state/use-deck-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/components/ui/utils";

const fmtDate = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function VersionHistory({ deck, analysis, onOpenCard }: { deck: Deck; analysis: DeckAnalysis; onOpenCard: (name: string) => void }) {
  const edit = useDeckEditor(deck);
  const currency = useDeckStore((s) => s.preferences.priceCurrency);
  const versions = useMemo(() => [...(deck.versions ?? [])].sort((a, b) => b.number - a.number), [deck.versions]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [toDelete, setToDelete] = useState<DeckVersion | null>(null);
  const unversioned = hasUnversionedChanges(deck);

  const va = versions.find((v) => v.id === (a || versions[1]?.id));
  const vb = versions.find((v) => v.id === (b || versions[0]?.id));
  const comparison = useMemo(() => (va && vb && va.id !== vb.id ? compareVersions(va, vb) : null), [va, vb]);

  function snapshot() {
    const v = createVersion(deck, analysis, notes, name || undefined);
    edit((d) => addVersion(d, v));
    toast(`Saved version ${v.number}.`, "success");
    setName("");
    setNotes("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <div className="grid content-start gap-4">
        <Panel>
          <PanelHeader as="h3" title="Save a version" icon={<Plus />} description="Snapshot the current card list with notes about what changed." />
          <PanelBody className="grid gap-3">
            {unversioned ? <Callout tone="info">The current deck differs from the latest saved version.</Callout> : versions.length > 0 && <p className="text-xs text-muted">The current deck matches the latest version.</p>}
            <div>
              <Label htmlFor="ver-name">Name (optional)</Label>
              <Input id="ver-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${deck.name} — v${versions.length + 1}`} />
            </div>
            <div>
              <Label htmlFor="ver-notes">Notes</Label>
              <Textarea id="ver-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Swapped in more removal after last night's games…" rows={3} />
            </div>
            <Button variant="primary" onClick={snapshot}>
              <Plus /> Save version {versions.length + 1}
            </Button>
          </PanelBody>
        </Panel>

        {versions.length >= 2 && (
          <Panel>
            <PanelHeader as="h3" title="Compare versions" icon={<GitCompare />} />
            <PanelBody className="grid gap-2">
              <div>
                <Label htmlFor="cmp-a">From</Label>
                <Select id="cmp-a" value={va?.id ?? ""} onChange={(e) => setA(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.number} · {v.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cmp-b">To</Label>
                <Select id="cmp-b" value={vb?.id ?? ""} onChange={(e) => setB(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.number} · {v.name}
                    </option>
                  ))}
                </Select>
              </div>
            </PanelBody>
          </Panel>
        )}
      </div>

      <div className="grid content-start gap-4">
        {comparison && (
          <Panel>
            <PanelHeader as="h3" title={`v${comparison.a.number} → v${comparison.b.number}`} icon={<GitCompare />} description={`${comparison.added.length} added, ${comparison.removed.length} removed, ${comparison.unchanged.length} unchanged`} />
            <PanelBody className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <NameList title="Added" names={comparison.added} tone="ok" onOpenCard={onOpenCard} />
                <NameList title="Removed" names={comparison.removed} tone="danger" onOpenCard={onOpenCard} />
                <NameList title="Unchanged" names={comparison.unchanged} tone="neutral" onOpenCard={onOpenCard} collapsed />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-1 font-normal">Stat</th>
                    <th className="py-1 text-right font-normal">v{comparison.a.number}</th>
                    <th className="py-1 text-right font-normal">v{comparison.b.number}</th>
                    <th className="py-1 text-right font-normal">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.stats.map((s) => (
                    <tr key={s.label} className="border-t border-line/60">
                      <td className="py-1 text-ink-2">{s.label}</td>
                      <td className="py-1 text-right tabular-nums text-ink">{formatMetric(s.a, s.format)}</td>
                      <td className="py-1 text-right tabular-nums text-ink">{formatMetric(s.b, s.format)}</td>
                      <td className={cn("py-1 text-right tabular-nums", s.delta > 0 ? "text-ok" : s.delta < 0 ? "text-danger" : "text-muted")}>
                        {s.delta > 0 ? "+" : ""}
                        {formatMetric(s.delta, s.format)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHeader as="h3" title="Change log" icon={<History />} description={versions.length ? `${versions.length} version${versions.length === 1 ? "" : "s"}` : undefined} />
          <PanelBody className="grid gap-3">
            {!versions.length && (
              <EmptyState icon={<History />} title="No versions yet">
                Save a version to start tracking how this deck evolves. Sandbox saves also create versions.
              </EmptyState>
            )}
            {versions.map((v) => (
              <article key={v.id} className="rounded-xl border border-line bg-bg-raised/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="gold">v{v.number}</Badge>
                    <span className="font-display text-sm text-ink">{v.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <time dateTime={new Date(v.createdAt).toISOString()}>{fmtDate(v.createdAt)}</time>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete version ${v.number}`} onClick={() => setToDelete(v)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                {v.notes && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink-2">{v.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>{v.stats.cards} cards</span>
                  <span>{v.stats.lands} lands</span>
                  <span>avg MV {v.stats.averageManaValue}</span>
                  <span>{v.stats.ramp} ramp</span>
                  <span>{v.stats.cardDraw} draw</span>
                  {v.stats.totalPrice > 0 && <span>{formatPrice(v.stats.totalPrice, currency)}</span>}
                </div>
                {(v.added.length > 0 || v.removed.length > 0) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <NameList title="Added" names={v.added} tone="ok" onOpenCard={onOpenCard} />
                    <NameList title="Removed" names={v.removed} tone="danger" onOpenCard={onOpenCard} />
                  </div>
                )}
              </article>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete version ${toDelete?.number ?? ""}?`}
        description="The snapshot and its notes will be removed. The deck's current cards are not affected."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (toDelete) edit((d) => removeVersion(d, toDelete.id));
          setToDelete(null);
        }}
      />
    </div>
  );
}

function NameList({ title, names, tone, onOpenCard, collapsed }: { title: string; names: string[]; tone: "ok" | "danger" | "neutral"; onOpenCard: (n: string) => void; collapsed?: boolean }) {
  const cls = tone === "ok" ? "border-ok/40 text-ok" : tone === "danger" ? "border-danger/40 text-danger" : "border-line text-ink-2";
  const body = names.length ? (
    <ul className="flex flex-wrap gap-1">
      {names.map((n) => (
        <li key={n}>
          <button type="button" onClick={() => onOpenCard(n)} className={cn("rounded-md border px-2 py-0.5 text-xs hover:brightness-125", cls)}>
            {n}
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <span className="text-xs text-muted">None</span>
  );
  if (collapsed)
    return (
      <details>
        <summary className="mb-1 cursor-pointer text-[10px] uppercase tracking-wider text-muted">
          {title} ({names.length})
        </summary>
        {body}
      </details>
    );
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
        {title} ({names.length})
      </p>
      {body}
    </div>
  );
}
