import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { effectiveGatePassStatus } from "@/lib/gatepass";
import { can } from "@/lib/permissions";
import { GatePassStatusBadge } from "@/components/StatusBadge";
import { CreateGatePassForm } from "./CreateGatePassForm";
import { RevokeGatePassButton } from "./RevokeGatePassButton";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export const metadata = { title: "Gate passes · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const RESULT_CHIP: Record<string, string> = {
  VALID: "bg-success-subtle text-success-fg",
  EXPIRED: "bg-danger-subtle text-danger-fg",
  NOT_YET_VALID: "bg-danger-subtle text-danger-fg",
  REVOKED: "bg-danger-subtle text-danger-fg",
  USED: "bg-danger-subtle text-danger-fg",
  NOT_FOUND: "bg-surface-2 text-fg",
};

const usedTag = (d: Date) => (
  <span className="ml-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
    Used {d.toLocaleString("en-PH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
  </span>
);

type Filter = "all" | "active" | "inactive";
type View = "passes" | "activity";

export default async function GatePassesPage({
  searchParams,
}: {
  searchParams: { filter?: string; view?: string };
}) {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "gatepass:write");
  const view: View = searchParams.view === "activity" ? "activity" : "passes";
  const filter: Filter =
    searchParams.filter === "active"
      ? "active"
      : searchParams.filter === "inactive"
      ? "inactive"
      : "all";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gate passes"
        action={
          view === "passes" && canWrite ? (
            <CreateGatePassFormLoader orgId={org.id} />
          ) : undefined
        }
      />

      <div className="flex gap-2">
        <Pill href="/gate-passes" active={view === "passes"}>
          Passes
        </Pill>
        <Pill href="/gate-passes?view=activity" active={view === "activity"}>
          Activity
        </Pill>
      </div>

      {view === "passes" ? (
        <PassesList orgId={org.id} filter={filter} canWrite={canWrite} />
      ) : (
        <ActivityLog orgId={org.id} />
      )}
    </div>
  );
}

async function CreateGatePassFormLoader({ orgId }: { orgId: string }) {
  const properties = await prisma.property.findMany({
    where: { orgId },
    select: { id: true, unitNumber: true },
    orderBy: { unitNumber: "asc" },
  });
  return <CreateGatePassForm properties={properties} />;
}

async function PassesList({
  orgId,
  filter,
  canWrite,
}: {
  orgId: string;
  filter: Filter;
  canWrite: boolean;
}) {
  const passes = await prisma.gatePass.findMany({
    where: { property: { orgId } },
    include: { property: { select: { id: true, unitNumber: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = passes.map((p) => {
    const display = effectiveGatePassStatus(p);
    // A spent single-use pass is no longer "active" even if still in its window.
    return { p, display, active: display === "ACTIVE" && !p.usedAt };
  });
  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.active).length,
    inactive: rows.filter((r) => !r.active).length,
  };
  const visible =
    filter === "active"
      ? rows.filter((r) => r.active)
      : filter === "inactive"
      ? rows.filter((r) => !r.active)
      : rows;

  const columns: ResponsiveColumn<(typeof rows)[number]>[] = [
    {
      key: "code",
      header: "Code",
      card: "title",
      className: "font-mono font-medium",
      cell: ({ p }) => (
        <Link
          href={`/pass/${p.code}`}
          target="_blank"
          className="font-mono text-fg underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
        >
          {p.code}
        </Link>
      ),
    },
    {
      key: "visitor",
      header: "Visitor",
      cell: ({ p }) => p.visitorName,
    },
    {
      key: "property",
      header: "Property",
      className: "text-fg-muted",
      cell: ({ p }) => (
        <Link href={`/properties/${p.property.id}`} className="hover:underline">
          {p.property.unitNumber}
        </Link>
      ),
    },
    {
      key: "valid",
      header: "Valid",
      card: "full",
      className: "text-fg-muted",
      cell: ({ p }) => `${fmt(p.validFrom)} – ${fmt(p.validUntil)}`,
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      className: "whitespace-nowrap",
      cell: ({ p, display }) => (
        <>
          <GatePassStatusBadge status={display} />
          {p.usedAt && usedTag(p.usedAt)}
        </>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      card: "action",
      cell: ({ p, active }) =>
        canWrite && active ? (
          <RevokeGatePassButton id={p.id} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Pill href="/gate-passes" active={filter === "all"}>
          All ({counts.all})
        </Pill>
        <Pill href="/gate-passes?filter=active" active={filter === "active"}>
          Active ({counts.active})
        </Pill>
        <Pill href="/gate-passes?filter=inactive" active={filter === "inactive"}>
          Expired / revoked ({counts.inactive})
        </Pill>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No gate passes yet. Create one for a visitor and share the code.
        </div>
      ) : (
        <ResponsiveTable
          rows={visible}
          rowKey={({ p }) => p.id}
          columns={columns}
          empty={
            <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-subtle">
              Nothing here.
            </div>
          }
        />
      )}
    </div>
  );
}

async function ActivityLog({ orgId }: { orgId: string }) {
  const scans = await prisma.gatePassScan.findMany({
    where: { orgId },
    include: {
      scannedBy: { select: { fullName: true } },
      gatePass: {
        select: {
          visitorName: true,
          property: { select: { unitNumber: true } },
        },
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 100,
  });

  if (scans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
        No gate checks yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-fg-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Time</th>
            <th className="px-4 py-2.5 font-medium">Code</th>
            <th className="px-4 py-2.5 font-medium">Visitor / unit</th>
            <th className="px-4 py-2.5 font-medium">Result</th>
            <th className="px-4 py-2.5 font-medium">Guard</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="px-4 py-2.5 text-fg-muted">{fmt(s.scannedAt)}</td>
              <td className="px-4 py-2.5 font-mono">{s.code}</td>
              <td className="px-4 py-2.5 text-fg-muted">
                {s.gatePass
                  ? `${s.gatePass.visitorName} · ${s.gatePass.property.unitNumber}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    RESULT_CHIP[s.result] ?? "bg-surface-2 text-fg"
                  }`}
                >
                  {s.result === "VALID" ? "Valid" : s.result.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-2.5 text-fg-muted">
                {s.scannedBy.fullName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-brand text-white"
          : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
