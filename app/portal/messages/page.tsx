import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { publicPhotoUrl } from "@/lib/marketplace";

export const metadata = { title: "Messages · HOA SaaS" };

const rel = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" });
};

export default async function MessagesPage() {
  const { user } = await getHomeownerContext();

  const conversations = await prisma.marketConversation.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      listing: { select: { title: true, photos: true } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: {
          messages: { where: { senderId: { not: user.id }, readAt: null } },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Messages</h1>

      {conversations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No conversations yet. Message a seller from the marketplace to start one.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {conversations.map((c) => {
            const other = c.buyer.id === user.id ? c.seller : c.buyer;
            const role = c.buyer.id === user.id ? "Seller" : "Buyer";
            const last = c.messages[0];
            const unread = c._count.messages;
            return (
              <li key={c.id}>
                <Link
                  href={`/portal/messages/${c.id}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50"
                >
                  <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100">
                    {c.listing.photos[0] && (
                      <img
                        src={publicPhotoUrl(c.listing.photos[0])}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">
                        {c.listing.title}
                      </span>
                      {last && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {rel(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {role}: {other.fullName}
                      {last ? ` · ${last.body}` : ""}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
