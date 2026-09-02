import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { parseStatementRange } from "@/lib/soa";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await getCurrentOrgContext();
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const account = url.searchParams.get("account") ?? "";

  const range = from || to ? parseStatementRange({ from, to }) : null;

  const entries = await prisma.journalEntry.findMany({
    where: {
      orgId: org.id,
      ...(range
        ? {
            entryDate: {
              ...(range.from ? { gte: range.from } : {}),
              lte: range.to,
            },
          }
        : {}),
      ...(account
        ? { lines: { some: { account: { code: account } } } }
        : {}),
    },
    include: { lines: { include: { account: true } } },
    orderBy: { entryDate: "asc" },
  });

  const header = [
    "entryDate",
    "sourceType",
    "memo",
    "accountCode",
    "accountName",
    "debit",
    "credit",
  ];
  const rows: (string | number)[][] = [];
  for (const e of entries) {
    for (const l of e.lines) {
      rows.push([
        e.entryDate.toISOString().slice(0, 10),
        e.sourceType,
        e.memo ?? "",
        l.account.code,
        l.account.name,
        Number(l.debit) ? Number(l.debit).toFixed(2) : "",
        Number(l.credit) ? Number(l.credit).toFixed(2) : "",
      ]);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(
    toCsvString([header, ...rows]),
    `ledger-${org.subdomain}-${date}.csv`
  );
}
