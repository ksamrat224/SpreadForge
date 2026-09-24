"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, type Icon } from "@tabler/icons-react";

export type ChartViewOption<T extends string> = {
  value: T;
  label: string;
  group: "Price" | "Analytics";
  Icon: Icon;
};

export function ChartViewPicker<T extends string>({
  view,
  options,
  onViewChange,
  eyebrow = "Market visualizer",
  label = "Chart view",
}: {
  view: T;
  options: ChartViewOption<T>[];
  onViewChange: (view: T) => void;
  eyebrow?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === view)!;
  const SelectedIcon = selected.Icon;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="chart-view-picker" ref={root}>
      <button
        type="button"
        className="paper-chart-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="eyebrow">{eyebrow}</span>
        <strong>
          <SelectedIcon size={15} /> {selected.label} <IconChevronDown size={14} />
        </strong>
      </button>
      {open && (
        <div className="paper-chart-menu" role="listbox" aria-label={label}>
          {(["Price", "Analytics"] as const).map((group) => {
            const groupOptions = options.filter((option) => option.group === group);
            if (!groupOptions.length) return null;
            return (
              <div key={group}>
                <span>{group}</span>
                {groupOptions.map((option) => {
                  const OptionIcon = option.Icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === view}
                      onClick={() => {
                        onViewChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <OptionIcon size={15} /> {option.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
