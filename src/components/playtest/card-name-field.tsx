"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { Input, Label } from "@/components/ui/input";

/** Pick card names from the deck with a datalist; each chosen name becomes a chip. */
export function CardNameField({ label, names, value, onChange }: { label: string; names: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const id = useId();
  const [text, setText] = useState("");

  function commit(raw: string) {
    const v = raw.trim();
    if (!v) return;
    const match = names.find((n) => n.toLowerCase() === v.toLowerCase()) ?? v;
    if (!value.includes(match)) onChange([...value, match]);
    setText("");
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={`${id}-list`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          }
        }}
        onBlur={() => commit(text)}
        placeholder="Type a card name and press Enter"
        autoComplete="off"
      />
      <datalist id={`${id}-list`}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {value.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {value.map((n) => (
            <li key={n} className="flex items-center gap-1 rounded-md border border-line bg-bg-raised px-1.5 py-0.5 text-xs text-ink-2">
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(value.filter((x) => x !== n))} className="text-muted hover:text-ink">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
