import Link from "next/link";
import { SideNav } from "./side-nav";
import { LogFab } from "./log-fab";
import { SaveIndicator } from "./field";

export function Shell({ title, meta, actions, children }: { title: string; meta?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="theme-ember grain relative min-h-screen text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[228px] flex-col border-r border-line bg-canvas lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-5">
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">PowerGoal</span>
        </div>
        <SideNav />
        <div className="mt-auto px-5 pb-5 text-[11.5px] text-ink-faint">Local database · this Mac</div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 lg:hidden">
        <Mark />
        <span className="text-[14px] font-semibold">PowerGoal</span>
        <div className="ml-auto"><SideNavCompact /></div>
      </div>

      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
          <div className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 2xl:px-8">
            <div>
              <h1 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h1>
              {meta && <div className="text-[12px] text-ink-muted">{meta}</div>}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <SaveIndicator />
              {actions}
            </div>
          </div>
        </header>
        {children}
      </div>
      <LogFab />
    </div>
  );
}

function SideNavCompact() {
  return (
    <nav className="flex gap-1 text-[13px]">
      <Link href="/" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:text-ink">Dashboard</Link>
      <Link href="/program" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:text-ink">Program</Link>
      <Link href="/log" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:text-ink">Log</Link>
      <Link href="/analytics" className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:text-ink">Analytics</Link>
    </nav>
  );
}

export function CardHeader({ icon: Icon, color, title, meta, right }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; color: string; title: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
      <span className="tile" style={{ background: color, color }}>
        <span className="text-[#0b0a09]"><Icon size={16} strokeWidth={2.2} /></span>
      </span>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</div>
        {meta && <div className="text-[11.5px] text-ink-muted">{meta}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="2" y="9.5" width="18" height="3" rx="1" fill="var(--color-accent)" />
      <rect x="0" y="6" width="3" height="10" rx="1" fill="var(--color-deadlift)" />
      <rect x="19" y="6" width="3" height="10" rx="1" fill="var(--color-squat)" />
    </svg>
  );
}
