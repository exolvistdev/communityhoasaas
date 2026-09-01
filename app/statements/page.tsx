import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { buildStatementsForOrg, parseStatementRange } from "@/lib/soa";
import { StatementDocument } from "@/components/StatementDocument";
import { PrintToolbar } from "./PrintToolbar";

export default async function BulkStatementsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; scope?: string };
}) {
  const { org } = await requireStaff();
  const range = parseStatementRange(searchParams);
  const scope = searchParams.scope === "outstanding" ? "outstanding" : "all";

  const statements = await buildStatementsForOrg(org.id, {
    ...range,
    onlyOutstanding: scope === "outstanding",
  });

  const csvQs = new URLSearchParams();
  if (searchParams.from) csvQs.set("from", searchParams.from);
  if (searchParams.to) csvQs.set("to", searchParams.to);

  return (
    <>
      <PrintToolbar csvHref={`/statements/export?${csvQs.toString()}`} />

      <div className="no-print mb-6 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Show:</span>
        <ScopePill href={scopeHref(searchParams, "all")} active={scope === "all"}>
          All properties
        </ScopePill>
        <ScopePill
          href={scopeHref(searchParams, "outstanding")}
          active={scope === "outstanding"}
        >
          With a balance
        </ScopePill>
      </div>

      {statements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {scope === "outstanding"
            ? "No properties have an outstanding balance."
            : "No properties yet."}
        </p>
      ) : (
        statements.map((s) => (
          <div key={s.propertyId} className="break-after-page mb-10">
            <StatementDocument statement={s} />
          </div>
        ))
      )}
    </>
  );
}

function scopeHref(
  sp: { from?: string; to?: string },
  scope: "all" | "outstanding"
) {
  const qs = new URLSearchParams();
  if (sp.from) qs.set("from", sp.from);
  if (sp.to) qs.set("to", sp.to);
  qs.set("scope", scope);
  return `/statements?${qs.toString()}`;
}

function ScopePill({
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
      className={`rounded-full px-3 py-1 ${
        active
          ? "bg-gray-900 text-white"
          : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
