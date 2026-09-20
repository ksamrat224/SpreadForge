"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { IconFlame, IconHexagon, IconX } from "@tabler/icons-react";
export const money = (cents: number, decimals = 2) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
export const signedMoney = (cents: number) =>
  `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;
export function ForgeMark() {
  return (
    <span className="forge-mark" aria-hidden="true">
      <IconHexagon size={34} stroke={1.4} />
      <IconFlame size={15} stroke={2} className="forge-flame" />
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${drawer ? "drawer" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <IconX size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PanelHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <span className="eyebrow">{label}</span>
      <strong className="mono">{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function ScoreBar({
  label,
  value,
  weight,
  target,
}: {
  label: string;
  value: number;
  weight?: number;
  target?: number;
}) {
  return (
    <div className="score-bar">
      <div>
        <span>
          {label}
          {weight && <small>{weight}%</small>}
        </span>
        <b className="mono">
          {Math.round(value)}
          <small>/100</small>
        </b>
      </div>
      <div
        className="bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        {target && (
          <span className="bar-target" style={{ left: `${target}%` }} />
        )}
      </div>
    </div>
  );
}
