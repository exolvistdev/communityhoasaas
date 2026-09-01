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
  VALID: "bg-green-100 text-green-800",
  EXPIRED: "bg-red-100 text-red-800",
  NOT_YET_VALID: "bg-red-100 text-red-800",
  REVOKED: "bg-red-100 text-red-800",
  NOT_FOUND: "bg-gray-200 text-gray-700",
};

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
        <h1 className="text-lg font-semibold text-gray-900">Gate passes</h1>
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

  const rows = passes.map((p) => ({ p, display: effectiveGatePassStatus(p) }));
  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.display === "ACTIVE").length,
    inactive: rows.filter((r) => r.display !== "ACTIVE").length,
  };
  const visible =
    filter === "active"
      ? rows.filter((r) => r.display === "ACTIVE")
      : filter === "inactive"
      ? rows.filter((r) => r.display !== "ACTIVE")
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
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No gate passes yet. Create one for a visitor and share the code.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
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
              {visible.map(({ p, display }) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono font-medium">
                    <Link
                      href={`/pass/${p.code}`}
                      target="_blank"
                      className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                    >
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{p.visitorName}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <Link
                      href={`/properties/${p.property.id}`}
                      className="hover:underline"
                    >
                      {p.property.unitNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {fmt(p.validFrom)} – {fmt(p.validUntil)}
                  </td>
                  <td className="px-4 py-2.5">
                    <GatePassStatusBadge status={display} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite && display === "ACTIVE" ? (
                      <RevokeGatePassButton id={p.id} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
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
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No gate checks yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
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
            <tr key={s.id} className="border-t border-gray-100">
              <td className="px-4 py-2.5 text-gray-600">{fmt(s.scannedAt)}</td>
              <td className="px-4 py-2.5 font-mono">{s.code}</td>
              <td className="px-4 py-2.5 text-gray-600">
                {s.gatePass
                  ? `${s.gatePass.visitorName} · ${s.gatePass.property.unitNumber}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    RESULT_CHIP[s.result] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {s.result === "VALID" ? "Valid" : s.result.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600">
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
          ? "bg-gray-900 text-white"
          : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
