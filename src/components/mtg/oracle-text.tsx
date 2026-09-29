import { ManaSymbol } from "./mana";

/** Oracle text with inline mana symbols and italic reminder text. */
export function OracleText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={className}>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line === "//" ? "my-2 border-t border-line" : "mb-1.5 last:mb-0"}>
          {line === "//"
            ? null
            : line.split(/(\{[^}]+\}|\([^)]*\))/g).map((part, j) => {
                const sym = /^\{([^}]+)\}$/.exec(part);
                if (sym) return <ManaSymbol key={j} symbol={sym[1]} className="mx-[1px] text-[0.95em]" />;
                if (/^\(.*\)$/.test(part)) return <em key={j} className="text-muted">{part}</em>;
                return <span key={j}>{part}</span>;
              })}
        </p>
      ))}
    </div>
  );
}
