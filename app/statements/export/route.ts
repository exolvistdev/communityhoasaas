import { getCurrentOrgContext } from "@/lib/tenant";
import {
  buildStatement,
  buildStatementsForOrg,
  parseStatementRange,
  type Statement,
} from "@/lib/soa";

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(statements: Statement[]) {
  const header = [
    "unit",
    "date",
    "type",
    "description",
    "charge",
    "payment",
    "balance",
  ];
  const rows: (string | number)[][] = [];
  for (const s of statements) {
    rows.push([s.unitNumber, "", "opening", "Opening balance", "", "", s.openingBalance.toFixed(2)]);
    for (const l of s.lines) {
      rows.push([
        s.unitNumber,
        l.date.toISOString().slice(0, 10),
        l.kind,
        l.description,
        l.charge ? l.charge.toFixed(2) : "",
        l.payment ? l.payment.toFixed(2) : "",
        l.balance.toFixed(2),
      ]);
    }
    rows.push([s.unitNumber, "", "closing", "Amount due", "", "", s.closingBalance.toFixed(2)]);
  }
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const { org } = await getCurrentOrgContext();
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  const range = parseStatementRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  let statements: Statement[];
  let filenameStem: string;

  if (propertyId) {
    const one = await buildStatement(propertyId, range);
    if (!one || one.orgId !== org.id) {
      return new Response("Not found", { status: 404 });
    }
    statements = [one];
    filenameStem = `soa-${one.unitNumber.replace(/\s+/g, "-")}`;
  } else {
    statements = await buildStatementsForOrg(org.id, range);
    filenameStem = `soa-${org.subdomain}-all`;
  }

  const csv = toCsv(statements);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameStem}-${date}.csv"`,
    },
  });
}
