"use client";

import { clsx } from "clsx";
import { ReferenceArea } from "recharts";
import { CardHeader } from "@/components/dash/shell";
import type { ABlock } from "@/lib/analytics";

export const tick = { fill: "var(--color-ink-faint)", fontSize: 11, fontFamily: "var(--font-geist)" } as const;
export const GRID = "rgba(255,255,255,0.05)";

export function Panel({
  icon, color, title, meta, right, children, className,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  color: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("panel overflow-hidden", className)}>
      <CardHeader icon={icon} color={color} title={title} meta={meta} right={right} />
      {children}
    </section>
  );
}

export function Tile({ label, value, unit, sub, color, tone }: { label: React.ReactNode; value: React.ReactNode; unit?: string; sub?: React.ReactNode; color?: string; tone?: "up" | "down" | null }) {
  return (
    <div className="panel px-5 py-4">
      <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
        {color && <i className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </div>
      <div className="num mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.03em]">
        {value}
        {unit && <span className="ml-1 text-[12.5px] font-normal text-ink-muted">{unit}</span>}
      </div>
      {sub && <div className={clsx("mt-2 text-[12px]", tone === "up" ? "text-positive" : tone === "down" ? "text-deadlift" : "text-ink-muted")}>{sub}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex items-center rounded-[10px] border border-line bg-surface-sunken p-0.5 text-[12px]">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={clsx("rounded-[8px] px-3 py-1.5 transition-colors", value === v ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function TipBox({ title, rows }: { title: React.ReactNode; rows: { color?: string; label: string; value: string; sub?: string }[] }) {
  return (
    <div className="min-w-[180px] rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[12px] shadow-[var(--shadow-pop)]">
      <div className="mb-1.5 text-ink-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-5 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-muted">
            {r.color && <i className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="text-right">
            <span className="num font-medium text-ink">{r.value}</span>
            {r.sub && <span className="block text-[11px] text-ink-faint">{r.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shaded bands behind a categorical time axis, one per block. */
export function blockBands<T extends { label: string; blockId: string }>(points: T[], blocks: ABlock[]) {
  return blocks
    .map((b, i) => {
      const inBlock = points.filter((p) => p.blockId === b.id);
      if (!inBlock.length) return null;
      return (
        <ReferenceArea
          key={b.id}
          x1={inBlock[0].label}
          x2={inBlock[inBlock.length - 1].label}
          fill="#ffffff"
          fillOpacity={i % 2 ? 0.025 : 0}
          ifOverflow="extendDomain"
          label={{ value: b.name, position: "insideTopLeft", fill: "var(--color-ink-faint)", fontSize: 10.5, offset: 8 }}
        />
      );
    })
    .filter(Boolean);
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-12 text-center text-[13px] text-ink-muted">{children}</div>;
}

export const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n * 10 ** digits) / 10 ** digits)}`;
