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
      <p className="text-sm text-gray-500">
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
      <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Gate pass</h1>
      <p className="text-sm text-gray-500">
        Register a visitor and share the code with them for the gate.
      </p>

      <RequestGatePassForm />

      {passes.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {passes.map((p) => {
            const status = effectiveGatePassStatus(p);
            return (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-gray-900">
                    {p.code}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {p.usedAt && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Used {fmt(p.usedAt)}
                      </span>
                    )}
                    <GatePassStatusBadge status={status} />
                  </span>
                </div>
                <div className="mt-0.5 text-gray-600">{p.visitorName}</div>
                <div className="text-xs text-gray-400">
                  {fmt(p.validFrom)} – {fmt(p.validUntil)}
                </div>
                <Link
                  href={`/pass/${p.code}`}
                  target="_blank"
                  className="mt-1 inline-block text-xs text-gray-500 underline hover:text-gray-900"
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
