import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { peso, periodLabel } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export default async function PortalHome() {
  const { user, property } = await getHomeownerContext();

  if (!property) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <h1 className="text-base font-semibold text-gray-900">
          Hi {user.fullName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Your account isn&apos;t linked to a unit yet. Please contact your HOA
          office so they can connect it.
        </p>
      </div>
    );
  }

  const now = new Date();
  const [statement, invoices, payments, pendingCount, announcementCount] =
    await Promise.all([
      buildStatement(property.id, parseStatementRange({})),
      prisma.invoice.findMany({
        where: { propertyId: property.id, status: { notIn: ["PAID", "VOID"] } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { invoice: { propertyId: property.id }, status: "CONFIRMED" },
        include: { invoice: { select: { period: true } } },
        orderBy: { paidAt: "desc" },
        take: 12,
      }),
      prisma.payment.count({
        where: { invoice: { propertyId: property.id }, status: "PENDING" },
      }),
      prisma.announcement.count({
        where: { orgId: property.orgId, publishedAt: { not: null } },
      }),
    ]);

  const balance = statement?.closingBalance ?? 0;
  const owes = balance > 0.005;
  const nextDue = invoices[0]?.dueDate ?? null;
  const overdue = invoices.some((i) => i.dueDate.getTime() < now.getTime());

  const cardTone = !owes
    ? "border-green-200 bg-green-50"
    : overdue
    ? "border-red-200 bg-red-50"
    : "border-amber-200 bg-amber-50";
  const amountTone = !owes
    ? "text-green-700"
    : overdue
    ? "text-red-700"
    : "text-amber-800";

  return (
    <div className="space-y-4">
      {/* balance card */}
      <div className={`rounded-xl border p-5 ${cardTone}`}>
        <div className="text-sm text-gray-600">
          {owes ? "Amount due" : "Balance"}
        </div>
        <div className={`mt-1 text-3xl font-semibold ${amountTone}`}>
          {peso(balance)}
        </div>
        {owes ? (
          <div className="mt-1 text-sm text-gray-600">
            {overdue ? "Overdue — " : ""}
            {nextDue ? `due ${fmtDate(nextDue)}` : ""}
          </div>
        ) : (
          <div className="mt-1 text-sm text-green-700">You&apos;re all paid up 🎉</div>
        )}

        {pendingCount > 0 && (
          <div className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs text-gray-600">
            {pendingCount} payment{pendingCount === 1 ? "" : "s"} submitted and
            awaiting confirmation by your HOA.
          </div>
        )}

        {owes && (
          <Link
            href="/portal/pay"
            className="mt-4 block rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Pay now
          </Link>
        )}
      </div>

      {/* action tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Tile href="/portal/gate-pass" label="Gate pass" sub="Register a visitor" />
        <Tile
          href="/portal/announcements"
          label="Announcements"
          sub={`${announcementCount} posted`}
        />
      </div>

      {/* payment history */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Payment history
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="text-gray-900">
                    {p.invoice.period
                      ? periodLabel(p.invoice.period)
                      : "Payment"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {METHOD_LABEL[p.method]} ·{" "}
                    {p.paidAt.toLocaleDateString("en-PH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="font-medium text-gray-900">
                  {peso(Number(p.amount))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300"
    >
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className="mt-0.5 text-xs text-gray-400">{sub}</div>
    </Link>
  );
}
