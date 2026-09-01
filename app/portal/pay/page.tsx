import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { PayNowClient } from "./PayNowClient";

export const metadata = { title: "Pay now · HOA SaaS" };

export default async function PayNowPage() {
  const { org, property } = await getHomeownerContext();

  if (!property) {
    return (
      <p className="text-sm text-gray-500">
        Your account isn&apos;t linked to a unit yet.
      </p>
    );
  }

  const [statement, openInvoice] = await Promise.all([
    buildStatement(property.id, parseStatementRange({})),
    prisma.invoice.findFirst({
      where: { propertyId: property.id, status: { notIn: ["PAID", "VOID"] } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const balance = Math.max(statement?.closingBalance ?? 0, 0);

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Pay now</h1>

      {balance <= 0.005 ? (
        <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          You have no balance due right now.
        </p>
      ) : !openInvoice ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          No open invoice to pay.
        </p>
      ) : (
        <PayNowClient
          balance={Number(balance.toFixed(2))}
          payment={{
            gcashNumber: org.gcashNumber,
            gcashName: org.gcashName,
            mayaNumber: org.mayaNumber,
            mayaName: org.mayaName,
            paymentInstructions: org.paymentInstructions,
          }}
        />
      )}
    </div>
  );
}
