import { notFound } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/tenant";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { StatementDocument } from "@/components/StatementDocument";
import { PrintToolbar } from "../PrintToolbar";

export default async function SingleStatementPage({
  params,
  searchParams,
}: {
  params: { propertyId: string };
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await getCurrentOrgContext();
  const range = parseStatementRange(searchParams);
  const statement = await buildStatement(params.propertyId, range);

  if (!statement || statement.orgId !== org.id) notFound();

  const qs = new URLSearchParams({ propertyId: params.propertyId });
  if (searchParams.from) qs.set("from", searchParams.from);
  if (searchParams.to) qs.set("to", searchParams.to);

  return (
    <>
      <PrintToolbar csvHref={`/statements/export?${qs.toString()}`} />
      <StatementDocument statement={statement} />
    </>
  );
}
