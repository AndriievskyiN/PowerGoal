"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";

/* ------------------------------------------------------------ save status */

let pending = 0;
let lastSaved = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => `${pending}:${lastSaved}`;

/** Track a save so the page-level indicator can show it. */
export async function track<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit();
  try {
    return await p;
  } finally {
    pending--;
    lastSaved = Date.now();
    emit();
  }
}

export function SaveIndicator() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "0:0");
  const [p, saved] = snap.split(":").map(Number);
  return (
    <span className="text-[12px] text-ink-faint" aria-live="polite">
      {p > 0 ? "Saving…" : saved ? "All changes saved" : ""}
    </span>
  );
}

/* ------------------------------------------------------------------- field */

/**
 * An input that shows the server value, lets you type freely, and saves on a
 * short pause or on blur. While a save is in flight it keeps showing what you
 * typed, so nothing flickers back.
 */
export function Field({
  value,
  onSave,
  className,
  delay = 500,
  ...props
}: {
  value: string;
  onSave: (text: string) => Promise<unknown> | void;
  /** Milliseconds to wait after typing. Negative means save on blur only (use for dates). */
  delay?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const [inflight, setInflight] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  function flush(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const r = onSave(next);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setInflight(true);
      track(r as Promise<unknown>).finally(() => setInflight(false));
    }
  }

  return (
    <input
      {...props}
      className={clsx("cell", className)}
      value={editing || inflight ? text : value}
      onFocus={(e) => {
        setText(value);
        setEditing(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        flush(text);
        props.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          dirty.current = false;
          setText(value);
          (e.target as HTMLInputElement).blur();
        }
        props.onKeyDown?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        dirty.current = true;
        if (timer.current) clearTimeout(timer.current);
        if (delay >= 0) timer.current = setTimeout(() => flush(next), delay);
      }}
    />
  );
}
