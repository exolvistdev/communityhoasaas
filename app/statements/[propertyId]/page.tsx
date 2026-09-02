import { notFound } from "next/navigation";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { statementViewerOrg } from "@/lib/statement-access";
import { getCurrentOrgContext } from "@/lib/tenant";
import { StatementDocument } from "@/components/StatementDocument";
import { PrintToolbar } from "@/components/PrintToolbar";

export default async function SingleStatementPage({
  params,
  searchParams,
}: {
  params: { propertyId: string };
  searchParams: { from?: string; to?: string };
}) {
  const orgId = await statementViewerOrg(params.propertyId);
  if (!orgId) notFound();

  const range = parseStatementRange(searchParams);
  const statement = await buildStatement(params.propertyId, range);
  if (!statement || statement.orgId !== orgId) notFound();

  const qs = new URLSearchParams({ propertyId: params.propertyId });
  if (searchParams.from) qs.set("from", searchParams.from);
  if (searchParams.to) qs.set("to", searchParams.to);

  const { user } = await getCurrentOrgContext();
  const isHomeowner = user.role === "HOMEOWNER";

  return (
    <>
      <PrintToolbar
        csvHref={`/statements/export?${qs.toString()}`}
        backHref={isHomeowner ? "/portal" : "/billing"}
        backLabel={isHomeowner ? "Back to portal" : "Back to billing"}
      />
      <StatementDocument statement={statement} />
    </>
  );
}
