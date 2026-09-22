"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarRange, LayoutDashboard, NotebookPen } from "lucide-react";
import { clsx } from "clsx";

const ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/program", label: "Program", icon: CalendarRange },
  { href: "/log", label: "Daily log", icon: NotebookPen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={clsx("side-item flex items-center gap-2.5 px-3 py-[8px] text-[13.5px]", active ? "side-item-active text-ink" : "text-ink-muted hover:text-ink")}
          >
            <it.icon size={16} strokeWidth={1.9} className={active ? "text-ink" : "text-ink-faint"} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
