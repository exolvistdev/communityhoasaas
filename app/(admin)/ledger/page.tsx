import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { trialBalance } from "@/lib/ledger";
import { parseStatementRange } from "@/lib/soa";
import { peso } from "@/lib/format";

export const metadata = { title: "Ledger · HOA SaaS" };

type View = "trial-balance" | "journal" | "accounts";

const TYPE_LABEL: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: { view?: string; from?: string; to?: string; account?: string };
}) {
  const { org } = await getCurrentOrgContext();
  const view: View =
    searchParams.view === "journal"
      ? "journal"
      : searchParams.view === "accounts"
      ? "accounts"
      : "trial-balance";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Ledger</h1>

      <div className="flex gap-2">
        <Tab href="/ledger" active={view === "trial-balance"}>
          Trial balance
        </Tab>
        <Tab href="/ledger?view=journal" active={view === "journal"}>
          Journal
        </Tab>
        <Tab href="/ledger?view=accounts" active={view === "accounts"}>
          Chart of accounts
        </Tab>
      </div>

      {view === "trial-balance" && <TrialBalance orgId={org.id} />}
      {view === "journal" && (
        <Journal orgId={org.id} searchParams={searchParams} />
      )}
      {view === "accounts" && <ChartOfAccounts orgId={org.id} />}
    </div>
  );
}

/* ─────────────────────────── trial balance ───────────────────────── */

async function TrialBalance({ orgId }: { orgId: string }) {
  const tb = await trialBalance(orgId);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 text-right font-medium">Debits</th>
              <th className="px-4 py-2.5 text-right font-medium">Credits</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 font-mono text-gray-600">{r.code}</td>
                <td className="px-4 py-2.5 text-gray-900">{r.name}</td>
                <td className="px-4 py-2.5 text-gray-500">
                  {TYPE_LABEL[r.type]}
                </td>
                <td className="px-4 py-2.5 text-right">{peso(r.debit)}</td>
                <td className="px-4 py-2.5 text-right">{peso(r.credit)}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {peso(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="px-4 py-2.5" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-2.5 text-right">{peso(tb.totalDebit)}</td>
              <td className="px-4 py-2.5 text-right">{peso(tb.totalCredit)}</td>
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        className={`text-sm ${
          tb.balanced ? "text-green-700" : "text-red-600"
        }`}
      >
        {tb.balanced
          ? "✓ Debits equal credits — the ledger is balanced."
          : `⚠ Out of balance by ${peso(
              Math.abs(tb.totalDebit - tb.totalCredit)
            )}.`}
      </p>
    </div>
  );
}

/* ────────────────────────────── journal ──────────────────────────── */

async function Journal({
  orgId,
  searchParams,
}: {
  orgId: string;
  searchParams: { from?: string; to?: string; account?: string };
}) {
  const accounts = await prisma.account.findMany({
    where: { orgId },
    orderBy: { code: "asc" },
  });

  const hasRange = Boolean(searchParams.from || searchParams.to);
  const range = hasRange ? parseStatementRange(searchParams) : null;
  const accountCode = searchParams.account || "";

  const entries = await prisma.journalEntry.findMany({
    where: {
      orgId,
      ...(range
        ? {
            entryDate: {
              ...(range.from ? { gte: range.from } : {}),
              lte: range.to,
            },
          }
        : {}),
      ...(accountCode
        ? { lines: { some: { account: { code: accountCode } } } }
        : {}),
    },
    include: {
      lines: { include: { account: true } },
      invoice: { include: { property: { select: { id: true, unitNumber: true } } } },
      payment: {
        include: {
          invoice: {
            include: { property: { select: { id: true, unitNumber: true } } },
          },
        },
      },
    },
    orderBy: { entryDate: "desc" },
    take: 200,
  });

  const exportQs = new URLSearchParams();
  if (searchParams.from) exportQs.set("from", searchParams.from);
  if (searchParams.to) exportQs.set("to", searchParams.to);
  if (accountCode) exportQs.set("account", accountCode);

  return (
    <div className="space-y-3">
      <form
        method="GET"
        action="/ledger"
        className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm"
      >
        <input type="hidden" name="view" value="journal" />
        <label>
          <span className="block text-xs text-gray-600">From</span>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
          />
        </label>
        <label>
          <span className="block text-xs text-gray-600">To</span>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
          />
        </label>
        <label>
          <span className="block text-xs text-gray-600">Account</span>
          <select
            name="account"
            defaultValue={accountCode}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800"
        >
          Apply
        </button>
        <a
          href="/ledger?view=journal"
          className="px-2 py-1.5 text-gray-500 hover:text-gray-900"
        >
          Reset
        </a>
        <a
          href={`/ledger/export?${exportQs.toString()}`}
          className="ml-auto rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50"
        >
          Download CSV
        </a>
      </form>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No journal entries match.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.length === 200 && (
            <p className="text-xs text-gray-400">
              Showing the 200 most recent entries — narrow the date range for
              older ones.
            </p>
          )}
          {entries.map((e) => {
            const prop =
              e.invoice?.property ?? e.payment?.invoice.property ?? null;
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                      {e.sourceType}
                    </span>
                    <span className="text-gray-900">{e.memo}</span>
                    {prop && (
                      <Link
                        href={`/properties/${prop.id}`}
                        className="text-xs text-gray-500 underline hover:text-gray-900"
                      >
                        {prop.unitNumber}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {fmtDate(e.entryDate)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="px-4 py-1.5 font-mono text-gray-500">
                          {l.account.code}
                        </td>
                        <td className="px-4 py-1.5 text-gray-700">
                          {l.account.name}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          {Number(l.debit) ? peso(Number(l.debit)) : ""}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          {Number(l.credit) ? peso(Number(l.credit)) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── chart of accounts ─────────────────────── */

async function ChartOfAccounts({ orgId }: { orgId: string }) {
  const accounts = await prisma.account.findMany({
    where: { orgId },
    include: { _count: { select: { journalLines: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Code</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Postings</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-gray-100">
              <td className="px-4 py-2.5 font-mono text-gray-600">{a.code}</td>
              <td className="px-4 py-2.5 text-gray-900">{a.name}</td>
              <td className="px-4 py-2.5 text-gray-500">{TYPE_LABEL[a.type]}</td>
              <td className="px-4 py-2.5 text-right text-gray-500">
                {a._count.journalLines}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────── ui ─────────────────────────────── */

function Tab({
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
