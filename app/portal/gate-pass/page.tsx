import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { effectiveGatePassStatus } from "@/lib/gatepass";
import { GatePassStatusBadge } from "@/components/StatusBadge";
import { RequestGatePassForm } from "./RequestGatePassForm";

export const metadata = { title: "Gate pass · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PortalGatePassPage() {
  const { property } = await getHomeownerContext();

  if (!property) {
    return (
      <p className="text-sm text-fg-muted">
        Your account isn&apos;t linked to a unit yet.
      </p>
    );
  }

  const passes = await prisma.gatePass.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Gate pass</h1>
      <p className="text-sm text-fg-muted">
        Register a visitor and share the code with them for the gate.
      </p>

      <RequestGatePassForm />

      {passes.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {passes.map((p) => {
            const status = effectiveGatePassStatus(p);
            return (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-fg">
                    {p.code}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {p.usedAt && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
                        Used {fmt(p.usedAt)}
                      </span>
                    )}
                    <GatePassStatusBadge status={status} />
                  </span>
                </div>
                <div className="mt-0.5 text-fg-muted">{p.visitorName}</div>
                <div className="text-xs text-fg-subtle">
                  {fmt(p.validFrom)} – {fmt(p.validUntil)}
                </div>
                <Link
                  href={`/pass/${p.code}`}
                  target="_blank"
                  className="mt-1 inline-block text-xs text-fg-muted underline hover:text-fg"
                >
                  Open visitor pass (QR) to share
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
