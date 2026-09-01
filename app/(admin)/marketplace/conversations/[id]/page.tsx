import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { priceLabel } from "@/lib/marketplace";
import { ConversationModeration } from "../ConversationModeration";

export const metadata = { title: "Conversation · HOA SaaS" };

const time = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function AdminConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("marketplace:moderate");

  const convo = await prisma.marketConversation.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      listing: { select: { id: true, title: true, price: true } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { fullName: true } } } },
      reports: {
        orderBy: { createdAt: "desc" },
        include: { reporter: { select: { fullName: true } } },
      },
    },
  });
  if (!convo) notFound();

  const openReports = convo.reports.filter((r) => !r.resolvedAt);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/marketplace/conversations"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Reported conversations
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">
          {convo.buyer.fullName} ↔ {convo.seller.fullName}
        </h1>
        <p className="text-sm text-gray-500">
          re:{" "}
          <Link
            href={`/marketplace/${convo.listing.id}`}
            className="hover:underline"
          >
            {convo.listing.title}
          </Link>{" "}
          · {priceLabel(Number(convo.listing.price))}
          {convo.closedAt ? " · closed" : ""}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Reports ({openReports.length} open)
        </h2>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {convo.reports.map((r) => (
            <li key={r.id} className="px-3 py-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-800">{r.reason}</span>
                {r.resolvedAt && (
                  <span className="shrink-0 text-xs text-gray-400">resolved</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {r.reporter.fullName} · {time(r.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Full thread ({convo.messages.length})
        </h2>
        <ul className="space-y-2">
          {convo.messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-gray-200 bg-white p-2.5 text-sm">
              <div className="text-xs text-gray-400">
                {m.sender.fullName} · {time(m.createdAt)}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-gray-800">
                {m.body}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {convo.closedAt && convo.closedReason && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Closed: {convo.closedReason}
        </p>
      )}

      <ConversationModeration
        id={convo.id}
        closed={Boolean(convo.closedAt)}
        hasOpenReports={openReports.length > 0}
      />
    </div>
  );
}
