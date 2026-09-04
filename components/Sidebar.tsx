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
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/Wordmark";

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
            <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
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
                    "relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-brand-subtle font-medium text-brand-accent"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-brand" />
                  )}
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

export function Sidebar({
  orgName,
  role,
  features,
}: {
  orgName: string;
  role: UserRole;
  features: FeatureFlags;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-2"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Wordmark subtitle={orgName} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-overlay/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <Wordmark subtitle={orgName} />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-2"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav role={role} features={features} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-4 py-4">
          <Wordmark subtitle={orgName} />
        </div>
        <Nav role={role} features={features} />
      </aside>
    </>
  );
}
