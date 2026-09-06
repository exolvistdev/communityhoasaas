"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Home,
  Receipt,
  CheckCheck,
  Droplet,
  BookOpen,
  FileBarChart,
  Truck,
  ShieldCheck,
  Megaphone,
  CalendarDays,
  Store,
  FileText,
  Wrench,
  CalendarClock,
  Vote,
  Users,
  Landmark,
  ScrollText,
  ShieldQuestion,
  Gavel,
  Settings,
  Building2,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell, type BellItem } from "@/components/NotificationBell";

type FeatureFlags = { water: boolean };
type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  show?: (r: UserRole) => boolean;
  /** hidden when the org-level flag of this name is false */
  feature?: keyof FeatureFlags;
};
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Home },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/reconciliation", label: "Reconciliation", icon: CheckCheck },
      {
        href: "/water",
        label: "Water billing",
        icon: Droplet,
        show: (r) => can(r, "billing:write"),
        feature: "water",
      },
      {
        href: "/bills",
        label: "Vendors & bills",
        icon: Truck,
        show: (r) => can(r, "vendor:manage"),
      },
      { href: "/ledger", label: "Ledger", icon: BookOpen },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/gate-passes", label: "Gate passes", icon: ShieldCheck },
      { href: "/announcements", label: "Announcements", icon: Megaphone },
      {
        href: "/meetings",
        label: "Board meetings",
        icon: CalendarClock,
        show: (r) => can(r, "meeting:manage"),
      },
      {
        href: "/votes",
        label: "Votes",
        icon: Vote,
        show: (r) => can(r, "vote:manage"),
      },
      {
        href: "/elections",
        label: "Elections",
        icon: Landmark,
        show: (r) => can(r, "election:manage"),
      },
      {
        href: "/board",
        label: "Board",
        icon: Users,
        show: (r) => can(r, "election:manage"),
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        icon: Wrench,
        show: (r) => can(r, "maintenance:manage"),
      },
      {
        href: "/violations",
        label: "Violations",
        icon: Gavel,
        show: (r) => can(r, "violation:manage"),
      },
      {
        href: "/amenities",
        label: "Amenities",
        icon: CalendarDays,
        show: (r) => can(r, "amenity:manage"),
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        icon: Store,
        show: (r) => can(r, "marketplace:moderate"),
      },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/team",
        label: "Team",
        icon: Users,
        show: (r) => can(r, "team:write"),
      },
      {
        href: "/audit",
        label: "Audit log",
        icon: ScrollText,
        show: (r) => r === "ADMIN",
      },
      {
        href: "/data-requests",
        label: "Privacy requests",
        icon: ShieldQuestion,
        show: (r) => r === "ADMIN",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        show: (r) => can(r, "settings:write"),
      },
    ],
  },
];

/** Login-style logo lockup — an indigo Building2 badge + the app name. */
function Brand({ orgName }: { orgName: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <Building2 className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-50">
          HOA Manager
        </span>
        <span className="block truncate text-xs text-slate-500">{orgName}</span>
      </span>
    </div>
  );
}

function Nav({
  role,
  features,
  onNavigate,
}: {
  role: UserRole;
  features: FeatureFlags;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => {
        const items = g.items.filter(
          (i) =>
            (!i.show || i.show(role)) &&
            (!i.feature || features[i.feature] !== false)
        );
        if (items.length === 0) return null;
        return (
          <div key={g.label} className="space-y-1">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {g.label}
            </div>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 border-l-2 px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "rounded-r-md border-indigo-500 bg-indigo-500/10 font-medium text-indigo-400"
                      : "rounded-md border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-slate-100"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Profile menu + notification bell, pinned to the bottom of the dark sidebar.
 * The `dark` wrapper re-declares the palette CSS vars for this subtree so the
 * reused (token-styled) `UserMenu` / `NotificationBell` / `ThemeToggle` render
 * against the slate-950 panel — without forking those shared components.
 */
function SidebarFooter({
  userName,
  role,
  residentHref,
  notifications,
}: {
  userName: string;
  role: UserRole;
  residentHref?: string;
  notifications: { unread: number; recent: BellItem[] };
}) {
  return (
    <div className="dark border-t border-slate-900 bg-slate-950 p-3">
      <div className="flex items-center justify-between gap-2">
        <UserMenu
          name={userName}
          role={role}
          residentHref={residentHref}
          openUp
          align="left"
        />
        <NotificationBell
          unread={notifications.unread}
          recent={notifications.recent}
          openUp
          align="left"
        />
      </div>
    </div>
  );
}

export function Sidebar({
  orgName,
  role,
  features,
  userName,
  residentHref,
  notifications,
}: {
  orgName: string;
  role: UserRole;
  features: FeatureFlags;
  userName: string;
  residentHref?: string;
  notifications: { unread: number; recent: BellItem[] };
}) {
  const [open, setOpen] = useState(false);

  const footer = (
    <SidebarFooter
      userName={userName}
      role={role}
      residentHref={residentHref}
      notifications={notifications}
    />
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 w-full items-center gap-3 border-b border-slate-900 bg-slate-950 px-4 pt-[env(safe-area-inset-top)] text-slate-300 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand orgName={orgName} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-slate-900 bg-slate-950 text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-900 px-4 py-3.5">
              <Brand orgName={orgName} />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav role={role} features={features} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-900 bg-slate-950 text-slate-300 lg:flex">
        <div className="border-b border-slate-900 px-4 py-4">
          <Brand orgName={orgName} />
        </div>
        <Nav role={role} features={features} />
        {footer}
      </aside>
    </>
  );
}
