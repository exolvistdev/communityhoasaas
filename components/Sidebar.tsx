"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { can } from "@/lib/permissions";

type NavItem = { href: string; label: string; show?: (role: UserRole) => boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/billing", label: "Billing" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/ledger", label: "Ledger" },
  { href: "/gate-passes", label: "Gate passes" },
  { href: "/announcements", label: "Announcements" },
  { href: "/team", label: "Team", show: (r) => can(r, "team:write") },
  { href: "/settings", label: "Settings", show: (r) => can(r, "settings:write") },
];

export function Sidebar({
  orgName,
  role,
}: {
  orgName: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.show || i.show(role));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">HOA</div>
        <div className="truncate font-medium text-gray-900">{orgName}</div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action="/auth/signout" method="post" className="p-3">
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
