import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { paymentQrUrl } from "@/lib/payment-qr";
import { PayNowClient } from "./PayNowClient";

export const metadata = { title: "Pay now · HOA SaaS" };

export default async function PayNowPage() {
  const { org, property } = await getHomeownerContext();

  if (!property) {
    return (
      <p className="text-sm text-fg-muted">
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
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Pay now</h1>

      {balance <= 0.005 ? (
        <p className="rounded-lg border border-success/30 bg-success-subtle p-4 text-sm text-success-fg">
          You have no balance due right now.
        </p>
      ) : !openInvoice ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-fg-muted">
          No open invoice to pay.
        </p>
      ) : (
        <PayNowClient
          balance={Number(balance.toFixed(2))}
          payment={{
            gcashNumber: org.gcashNumber,
            gcashName: org.gcashName,
            gcashQrUrl: org.gcashQrPath ? paymentQrUrl(org.gcashQrPath) : null,
            mayaNumber: org.mayaNumber,
            mayaName: org.mayaName,
            mayaQrUrl: org.mayaQrPath ? paymentQrUrl(org.mayaQrPath) : null,
            paymentInstructions: org.paymentInstructions,
          }}
        />
      )}
    </div>
  );
}
