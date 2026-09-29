"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

/** Chart palette: series hues validated for the dark panel surface. */
export const SERIES = { primary: "#b98530", secondary: "#4d88d4" };
export const MANA_SERIES: Record<string, string> = {
  W: "#d4b866",
  U: "#3f8fe0",
  B: "#b86aae",
  R: "#e2583a",
  G: "#3fa35f",
  C: "#9aa0a6",
  Colorless: "#9aa0a6",
  Multicolor: "#c9a25a",
};
const SURFACE = "#1c181e";
const GRID = "#2d2731";
const AXIS = "#948a7d";

const tooltipStyle = {
  contentStyle: { background: "#2d2731", border: "1px solid #4a4150", borderRadius: 10, color: "#ece3cf", fontSize: 12 },
  labelStyle: { color: "#c7bda9", marginBottom: 4 },
  itemStyle: { color: "#ece3cf", padding: 0 },
  cursor: { fill: "#ffffff08" },
};

/** Legend labels wear text ink; the swatch beside them carries the series color. */
export const legendText = (value: string) => <span style={{ color: "#c7bda9" }}>{value}</span>;

export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  format?: (v: T[keyof T]) => string;
}

/** Panel with a chart and an accessible table view of the same data. */
export function ChartPanel<T extends object>({
  title,
  description,
  rows,
  columns,
  children,
  className,
}: {
  title: string;
  description?: string;
  rows: T[];
  columns: TableColumn<T>[];
  children: React.ReactNode;
  className?: string;
}) {
  const [table, setTable] = useState(false);
  return (
    <Panel className={className}>
      <PanelHeader
        as="h3"
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            aria-pressed={table}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-panel-3 hover:text-ink"
          >
            {table ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
            {table ? "Chart" : "Table"}
          </button>
        }
      />
      <PanelBody>
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className="py-1.5 pr-4 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    {columns.map((c) => (
                      <td key={c.key} className="py-1.5 pr-4 tabular-nums text-ink-2">
                        {c.format ? c.format(r[c.key]) : String(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64" role="img" aria-label={`${title} chart. Use the Table button for the data.`}>
            {children}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export function ManaCurveChart({ data }: { data: { mv: string; creatures: number; other: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="mv" tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
        <RTooltip {...tooltipStyle} labelFormatter={(l) => `Mana value ${l}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={legendText} />
        <Bar dataKey="creatures" name="Creatures" stackId="a" fill={SERIES.primary} stroke={SURFACE} strokeWidth={2} maxBarSize={28} />
        <Bar dataKey="other" name="Noncreature spells" stackId="a" fill={SERIES.secondary} stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28}>
          <LabelList dataKey="count" position="top" fill="#c7bda9" fontSize={11} formatter={(v) => (Number(v) ? String(v) : "")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal single-series bars with value labels at the tip. */
export function HorizontalBars({
  data,
  colorFor,
}: {
  data: { label: string; value: number; key?: string }[];
  colorFor?: (row: { label: string; key?: string }) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }} barCategoryGap="25%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={92} tick={{ fill: "#c7bda9", fontSize: 12 }} axisLine={false} tickLine={false} />
        <RTooltip {...tooltipStyle} />
        <Bar dataKey="value" name="Cards" radius={[0, 4, 4, 0]} maxBarSize={20} fill={SERIES.primary}>
          {colorFor && data.map((row, i) => <Cell key={i} fill={colorFor(row)} />)}
          <LabelList dataKey="value" position="right" fill="#c7bda9" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Colored pip demand vs. mana sources, as shares, per color. */
export function PipsVsSourcesChart({ data }: { data: { label: string; pips: number; sources: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%" barGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
        <RTooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} formatter={legendText} />
        <Bar dataKey="pips" name="Share of colored pips" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="sources" name="Share of mana sources" fill={SERIES.secondary} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
