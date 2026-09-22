"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check, Dumbbell, Footprints, HeartPulse, Moon, Plus, Scale, StickyNote, X } from "lucide-react";
import { clsx } from "clsx";

const OPTIONS = [
  { key: "weight", label: "Bodyweight", unit: "kg", icon: Scale, step: 0.1, placeholder: "93.4" },
  { key: "sleep", label: "Sleep", unit: "h", icon: Moon, step: 0.25, placeholder: "7.5" },
  { key: "recovery", label: "Recovery", unit: "/10", icon: HeartPulse, step: 1, placeholder: "7" },
  { key: "steps", label: "Steps", unit: "", icon: Footprints, step: 100, placeholder: "9000" },
  { key: "note", label: "Note", unit: "", icon: StickyNote, step: 0, placeholder: "How did it feel?" },
  { key: "session", label: "Session", unit: "", icon: Dumbbell, step: 0, placeholder: "" },
] as const;

type Key = (typeof OPTIONS)[number]["key"];

/** Floating log button: fans out into a quarter-circle of options. */
export function LogFab() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Key | null>(null);
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const logMetric = useMutation(api.dailyMetrics.log);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setActive(null), setOpen(false));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const opt = OPTIONS.find((o) => o.key === active);
  const radius = 104;
  const n = OPTIONS.length;

  async function save() {
    if (!opt) return;
    const today = new Date().toISOString().slice(0, 10);
    if (opt.key === "note") await logMetric({ date: today, notes: value });
    else if (value !== "") await logMetric({ date: today, [opt.key]: parseFloat(value) });
    setToast(`${opt.label}${value ? ` · ${value}${opt.unit ? ` ${opt.unit}` : ""}` : ""} logged`);
    setValue("");
    setActive(null);
    setOpen(false);
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-30" onClick={() => (setActive(null), setOpen(false))} />}

      <div className="fixed right-7 bottom-7 z-40">
        {OPTIONS.map((o, i) => {
          const angle = Math.PI / 2 + (i / (n - 1)) * (Math.PI / 2);
          const x = Math.cos(angle) * radius;
          const y = -Math.sin(angle) * radius;
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              onClick={() => (o.key === "session" ? router.push("/") : (setActive(o.key), setValue("")))}
              aria-label={o.label}
              title={o.label}
              style={{
                transform: open ? `translate(${x}px, ${y}px) scale(1)` : "translate(0,0) scale(0.4)",
                opacity: open ? 1 : 0,
                transitionDelay: open ? `${i * 30}ms` : `${(n - i) * 20}ms`,
                pointerEvents: open ? "auto" : "none",
              }}
              className={clsx(
                "panel absolute right-1 bottom-1 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:bg-surface-hover",
                active === o.key && "bg-[var(--color-accent)] text-ink-inverse hover:bg-[var(--color-accent)]",
              )}
            >
              <Icon size={17} strokeWidth={2} />
            </button>
          );
        })}

        <button
          onClick={() => (setActive(null), setOpen(!open))}
          aria-expanded={open}
          className="btn-fab relative flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[var(--color-accent)] text-ink-inverse shadow-[0_2px_4px_rgba(0,0,0,.2),0_14px_30px_-10px_rgba(0,0,0,.5)] transition-transform duration-300 hover:scale-105"
        >
          <Plus size={22} strokeWidth={2.5} className={clsx("transition-transform duration-300", open && "rotate-45")} />
        </button>

        {opt && (
          <div className="panel absolute right-0 bottom-[164px] w-[260px] p-4 shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{opt.label}</span>
              <button onClick={() => setActive(null)} className="text-ink-faint hover:text-ink"><X size={14} /></button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                type={opt.step ? "number" : "text"}
                step={opt.step || undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={opt.placeholder}
                className="num h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-sunken px-3 text-[15px] outline-none focus:border-line-strong"
              />
              {opt.unit && <span className="text-[12px] text-ink-faint">{opt.unit}</span>}
            </div>
            <button onClick={save} className="btn-raised mt-3 flex h-9 w-full items-center justify-center gap-1.5 bg-[var(--color-accent)] text-[12.5px] font-semibold text-ink-inverse">
              <Check size={13} strokeWidth={3} /> Save for today
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="panel fixed bottom-7 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 px-3.5 py-2 text-[12.5px]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-ink-inverse"><Check size={10} strokeWidth={3} /></span>
          {toast}
        </div>
      )}
    </>
  );
}
