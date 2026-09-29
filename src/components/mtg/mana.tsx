import type { Color } from "@/lib/types";
import { cn } from "@/components/ui/utils";
import { COLOR_NAMES } from "@/lib/cards/helpers";

const FILL: Record<string, string> = {
  W: "bg-[#efe3bd] text-[#3b3322]",
  U: "bg-[#5ea3e6] text-[#0f2233]",
  B: "bg-[#9d8aa6] text-[#1b1420]",
  R: "bg-[#e7704f] text-[#2d110a]",
  G: "bg-[#58b374] text-[#0f2415]",
  C: "bg-[#c8c3bd] text-[#2a2724]",
};
const HEX: Record<string, string> = { W: "#efe3bd", U: "#5ea3e6", B: "#9d8aa6", R: "#e7704f", G: "#58b374", C: "#c8c3bd" };

function symbolLabel(sym: string) {
  if (/^\d+$/.test(sym)) return `${sym} generic mana`;
  if (sym === "X") return "X mana";
  const parts = sym.split("/").map((p) => (p === "P" ? "Phyrexian" : COLOR_NAMES[p as Color] ?? p));
  return parts.join(" or ");
}

/** One mana symbol, drawn in-app (no external symbol images). */
export function ManaSymbol({ symbol, className }: { symbol: string; className?: string }) {
  const parts = symbol.split("/");
  const colors = parts.filter((p) => p in FILL);
  const base = "inline-grid size-[1.15em] place-items-center rounded-full text-[0.68em] font-bold leading-none shadow-[inset_0_-1px_0_#0004,0_1px_1px_#0006]";
  if (colors.length === 2) {
    return (
      <span
        title={symbolLabel(symbol)}
        className={cn(base, "text-[#1b1420]", className)}
        style={{ background: `linear-gradient(135deg, ${HEX[colors[0]]} 50%, ${HEX[colors[1]]} 50%)` }}
      />
    );
  }
  const color = colors[0];
  return (
    <span title={symbolLabel(symbol)} className={cn(base, color ? FILL[color] : FILL.C, className)}>
      {color && parts.includes("P") ? "φ" : color ? "" : symbol}
    </span>
  );
}

/** Renders a mana cost string like "{2}{W}{B}". */
export function ManaCost({ cost, className }: { cost: string; className?: string }) {
  if (!cost) return null;
  const faces = cost.split(" // ");
  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle", className)} aria-label={`Mana cost ${cost}`} role="img">
      {faces.map((face, fi) => (
        <span key={fi} className="inline-flex items-center gap-0.5">
          {fi > 0 && <span className="mx-1 text-muted">{"//"}</span>}
          {[...face.matchAll(/\{([^}]+)\}/g)].map((m, i) => (
            <ManaSymbol key={i} symbol={m[1]} />
          ))}
        </span>
      ))}
    </span>
  );
}

/** Color identity pips, e.g. W B G. Colorless shows a single C. */
export function ColorPips({ colors, className, size = "md" }: { colors: Color[]; className?: string; size?: "sm" | "md" }) {
  const list = colors.length ? colors : (["C"] as const);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", size === "sm" ? "text-sm" : "text-lg", className)}
      role="img"
      aria-label={`Color identity: ${colors.length ? colors.map((c) => COLOR_NAMES[c]).join(", ") : "Colorless"}`}
    >
      {list.map((c) => (
        <ManaSymbol key={c} symbol={c} />
      ))}
    </span>
  );
}

export { HEX as MANA_HEX };
