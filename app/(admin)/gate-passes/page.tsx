import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { effectiveGatePassStatus } from "@/lib/gatepass";
import { can } from "@/lib/permissions";
import { GatePassStatusBadge } from "@/components/StatusBadge";
import { CreateGatePassForm } from "./CreateGatePassForm";
import { RevokeGatePassButton } from "./RevokeGatePassButton";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg">Gate passes</h1>
        {view === "passes" && canWrite && (
          <CreateGatePassFormLoader orgId={org.id} />
        )}
      </div>

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
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Visitor</th>
                <th className="px-4 py-2.5 font-medium">Property</th>
                <th className="px-4 py-2.5 font-medium">Valid</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ p, display, active }) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono font-medium">
                    <Link
                      href={`/pass/${p.code}`}
                      target="_blank"
                      className="text-fg underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                    >
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{p.visitorName}</td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    <Link
                      href={`/properties/${p.property.id}`}
                      className="hover:underline"
                    >
                      {p.property.unitNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {fmt(p.validFrom)} – {fmt(p.validUntil)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <GatePassStatusBadge status={display} />
                    {p.usedAt && usedTag(p.usedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite && active ? (
                      <RevokeGatePassButton id={p.id} />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-fg-subtle"
                  >
                    Nothing here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
