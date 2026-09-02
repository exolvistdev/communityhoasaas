"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Store, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/portal", label: "Home", icon: Home, exact: true },
  { href: "/portal/amenities", label: "Amenities", icon: CalendarDays },
  { href: "/portal/market", label: "Market", icon: Store },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
];

export function PortalTabBar({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                active ? "text-brand-accent" : "text-fg-subtle hover:text-fg"
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
              {t.href === "/portal/messages" && unread > 0 && (
                <span className="absolute right-[calc(50%-1.25rem)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-fg">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
