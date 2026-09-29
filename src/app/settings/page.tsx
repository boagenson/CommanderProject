"use client";

import { Database, Download, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Strategy } from "@/lib/types";
import { STRATEGIES } from "@/lib/types";
import { cardCacheSize, clearCardCache, clearResponseCache } from "@/lib/scryfall";
import { exportAllData, importAllData } from "@/lib/storage";
import { useDecks, useDeckStore } from "@/lib/state/deck-store";
import { toast } from "@/lib/state/toast-store";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

export default function SettingsPage() {
  const { preferences, decks } = useDecks();
  const setPreferences = useDeckStore((s) => s.setPreferences);
  const [cacheSize, setCacheSize] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage-backed cache size after mount
  useEffect(() => setCacheSize(cardCacheSize()), []);

  function download() {
    const blob = new Blob([exportAllData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commander-workshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File) {
    try {
      const n = importAllData(await file.text());
      toast(`Restored ${n} deck${n === 1 ? "" : "s"}. Reloading…`, "success");
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast((err as Error).message || "That backup couldn't be read.", "error");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Preferences" title="Settings" description="Preferences and data are stored in this browser." />
      <div className="grid max-w-3xl gap-5">
        <Panel>
          <PanelHeader title="Deckbuilding defaults" />
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-budget">Default upgrade budget ($)</Label>
              <Input id="s-budget" type="number" min={0} value={preferences.defaultBudget} onChange={(e) => setPreferences({ defaultBudget: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label htmlFor="s-strategy">Default strategy</Label>
              <Select id="s-strategy" value={preferences.defaultStrategy} onChange={(e) => setPreferences({ defaultStrategy: e.target.value as Strategy })}>
                {STRATEGIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="s-view">Deck view</Label>
              <Select id="s-view" value={preferences.cardView} onChange={(e) => setPreferences({ cardView: e.target.value as "list" | "visual" })}>
                <option value="list">List</option>
                <option value="visual">Visual (card images)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-currency">Price currency</Label>
              <Select id="s-currency" value={preferences.priceCurrency} onChange={(e) => setPreferences({ priceCurrency: e.target.value as "usd" | "eur" | "tix" })}>
                <option value="usd">USD (TCGplayer)</option>
                <option value="eur">EUR (Cardmarket)</option>
                <option value="tix">MTGO tix</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
              <input type="checkbox" checked={preferences.showPrices} onChange={(e) => setPreferences({ showPrices: e.target.checked })} className="accent-[var(--gold)]" />
              Show prices in the deck list
            </label>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Data" icon={<Database />} description={`${decks.length} deck${decks.length === 1 ? "" : "s"} saved · ${cacheSize} cards cached from Scryfall`} />
          <PanelBody className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download /> Export backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload /> Restore backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Backup file"
              onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
            />
            <Button
              variant="danger"
              onClick={() => {
                clearCardCache();
                clearResponseCache();
                setCacheSize(0);
                toast("Card cache cleared. Cards will be re-fetched from Scryfall as needed.", "success");
              }}
            >
              <Trash2 /> Clear card cache
            </Button>
          </PanelBody>
        </Panel>

        <p className="text-xs text-muted">
          Card data, images and prices come from the Scryfall API. Commander Workshop is unofficial Fan Content and is not affiliated with Wizards of the Coast.
        </p>
      </div>
    </>
  );
}
