"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export function ThemedSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = "",
  prefix,
  disabled = false,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
  prefix?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div className={`themed-select ${className}`} ref={root}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {prefix}
        <span className="themed-select-value">
          {selected.icon}
          <span>{selected.label}</span>
        </span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="themed-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => { onChange(option.value); setOpen(false); }}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
